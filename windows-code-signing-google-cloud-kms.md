# Windows code signing with Google Cloud KMS

This guide configures GitHub Actions to sign Windows Electron installers with Jsign and Google Cloud KMS, then verify the resulting Authenticode signature with Microsoft SignTool. The private key remains non-exportable in Google Cloud KMS Cloud HSM.

It assumes that:

- the Google Cloud project, HSM-backed asymmetric signing key, and enabled key version already exist;
- a certificate authority has issued the code-signing certificate for that key;
- the leaf certificate and CA intermediate certificates are available as `.cer`, `.pem`, `.p7b`, or `.spc` files; and
- an administrator can configure Google Cloud IAM and GitHub repository settings.

Certificate enrollment, certificate pickup, CSR generation, and initial KMS/HSM key creation are intentionally out of scope.

## How the integration works

1. GitHub Actions requests a short-lived OpenID Connect (OIDC) token.
2. Google Cloud Workload Identity Federation exchanges that token for short-lived credentials for a dedicated service account.
3. The Windows runner prepares a certificate chain file and downloads a pinned Jsign release.
4. Jsign creates the Authenticode signature while the private-key operation is performed by Google Cloud KMS.
5. Jsign requests an RFC 3161 timestamp, and SignTool verifies the completed Authenticode signature.

No service-account JSON key, PFX file, or exportable private key is stored in GitHub.

## Repository layout

Keep this document at:

```text
docs/windows-code-signing-google-cloud-kms.md
```

This is CI and release-operations documentation, so it belongs under `docs/` rather than in the repository root.

## Required values

Choose values for the following placeholders.

| Value | Example |
| --- | --- |
| Google Cloud project ID | `my-code-signing-project` |
| GitHub repositories allowed to sign | `my-org/main-repo`, `trusted-user/fork-repo` |
| Service account ID | `github-code-signer` |
| Workload Identity Pool ID | `github-actions` |
| Workload Identity Provider ID | `windows-code-signing` |
| Full KMS key-version resource | `projects/my-code-signing-project/locations/global/keyRings/codesigning/cryptoKeys/windows-code-signing/cryptoKeyVersions/2` |
| Leaf certificate | `code-signing.cer` |
| Intermediate certificates | `intermediate1.cer`, optionally `intermediate2.cer` |
| Jsign release | `7.5` |

Always use the fully qualified, enabled KMS key version, including `/cryptoKeyVersions/N`. Pinning the version prevents a disabled or unintended version from being selected.

## Multi-repository model

There are two separate authorization layers:

- Workload Identity Provider admission decides which GitHub OIDC tokens Google Cloud will accept.
- The service account IAM policy decides which admitted repositories may impersonate the signing service account.

For a main repository and a fork repository, either:

- use one provider and one service account with an exact allow list of trusted repositories; or
- use separate providers and service accounts when the repositories need separate audit or blast-radius boundaries.

Do not rely only on repository owner checks when personal forks are allowed to sign. Prefer exact repository names such as `my-org/main-repo` and `trusted-user/fork-repo`.

When a reusable workflow is used, the GitHub OIDC `repository` claim identifies the calling repository. The `job_workflow_ref` claim identifies the reusable workflow file and ref, so it can be added to the provider condition when you want only a specific reusable workflow to be trusted.

## 1. Configure Google Cloud access

Run these commands once from macOS, Linux, or Cloud Shell. Replace every example value before running the commands; values such as `my-code-signing-project`, `my-org/main-repo`, and `trusted-user/fork-repo` are placeholders.

```bash
export PROJECT_ID="my-code-signing-project"
export SERVICE_ACCOUNT_ID="github-code-signer"
export POOL_ID="github-actions"
export PROVIDER_ID="windows-code-signing"
export SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

GITHUB_REPOSITORIES=(
  "my-org/main-repo"
  "trusted-user/fork-repo"
)

gcloud auth login
gcloud config set project "$PROJECT_ID"

gcloud services enable \
  cloudkms.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  --project="$PROJECT_ID"
```

Create the dedicated service account if it does not already exist:

```bash
gcloud iam service-accounts create "$SERVICE_ACCOUNT_ID" \
  --project="$PROJECT_ID" \
  --display-name="GitHub Windows code signer"
```

Grant the service account only the ability to sign and read the public key, scoped to the specific KMS key:

```bash
export KMS_LOCATION="global"
export KMS_KEYRING="codesigning"
export KMS_KEY="windows-code-signing"

gcloud kms keys add-iam-policy-binding "$KMS_KEY" \
  --project="$PROJECT_ID" \
  --location="$KMS_LOCATION" \
  --keyring="$KMS_KEYRING" \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/cloudkms.signerVerifier"
```

Create the Workload Identity Pool if it does not already exist:

```bash
gcloud iam workload-identity-pools create "$POOL_ID" \
  --project="$PROJECT_ID" \
  --location=global \
  --display-name="GitHub Actions"
```

Create a GitHub OIDC provider with an exact repository allow list:

```bash
export GITHUB_REPOSITORY_CONDITION="assertion.repository in ['my-org/main-repo', 'trusted-user/fork-repo']"

gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location=global \
  --workload-identity-pool="$POOL_ID" \
  --display-name="GitHub Windows code signing" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.ref=assertion.ref,attribute.job_workflow_ref=assertion.job_workflow_ref" \
  --attribute-condition="$GITHUB_REPOSITORY_CONDITION"
```

If the provider already exists, update its condition when adding or removing trusted repositories:

```bash
gcloud iam workload-identity-pools providers update-oidc "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location=global \
  --workload-identity-pool="$POOL_ID" \
  --attribute-condition="$GITHUB_REPOSITORY_CONDITION"
```

Allow each trusted repository to impersonate the signing service account:

```bash
export POOL_NAME="$(gcloud iam workload-identity-pools describe "$POOL_ID" \
  --project="$PROJECT_ID" \
  --location=global \
  --format='value(name)')"

for repo in "${GITHUB_REPOSITORIES[@]}"; do
  gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT_EMAIL" \
    --project="$PROJECT_ID" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/${POOL_NAME}/attribute.repository/${repo}"
done
```

Record the full provider resource name and service-account email:

```bash
gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location=global \
  --workload-identity-pool="$POOL_ID" \
  --format='value(name)'

echo "$SERVICE_ACCOUNT_EMAIL"
```

The provider name has this form and uses the project number:

```text
projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID
```

For production signing, consider adding branch, tag, environment, or reusable-workflow restrictions. For example:

```text
assertion.repository == 'my-org/main-repo' &&
assertion.ref == 'refs/heads/main' &&
assertion.job_workflow_ref == 'my-org/main-repo/.github/workflows/electron-build.yml@refs/heads/main'
```

For different rules per repository, use an explicit OR expression:

```text
(assertion.repository == 'my-org/main-repo' && assertion.ref == 'refs/heads/main') ||
(assertion.repository == 'trusted-user/fork-repo' && assertion.ref == 'refs/heads/release-test')
```

## 2. Configure GitHub repositories

Set these repository variables in every repository that is allowed to sign. A main repository and a fork can use the same values or different values, depending on the Google Cloud setup chosen above.

These four `GCP_CODE_SIGNING_*` values are Google Cloud resource identifiers, not private credentials. Repository variables are preferred because they are easier to inspect and rotate. The reusable workflow also accepts the same four names as repository or environment secrets for compatibility, but do not mix variables and secrets unless you are intentionally overriding one value.

| GitHub variable | Contents |
| --- | --- |
| `GCP_CODE_SIGNING_PROJECT_ID` | Google Cloud project ID |
| `GCP_CODE_SIGNING_WORKLOAD_IDENTITY_PROVIDER` | Full Workload Identity Provider resource name |
| `GCP_CODE_SIGNING_SERVICE_ACCOUNT` | Signing service-account email |
| `GCP_CODE_SIGNING_KMS_KEY_VERSION` | Full KMS key-version resource name |
| `JSIGN_VERSION` | Optional Jsign release version, default `7.5` |
| `JSIGN_SHA256` | Optional SHA256 for the Jsign JAR, default pinned for Jsign `7.5` |
| `WINDOWS_SIGNING_TIMESTAMP_URL` | Optional timestamp URL, default `http://timestamp.digicert.com` |

If these identifiers are stored as secrets instead of variables, use the same names:

```text
GCP_CODE_SIGNING_PROJECT_ID
GCP_CODE_SIGNING_WORKLOAD_IDENTITY_PROVIDER
GCP_CODE_SIGNING_SERVICE_ACCOUNT
GCP_CODE_SIGNING_KMS_KEY_VERSION
```

The workflow reads variables first through reusable-workflow inputs, then falls back to secrets with the same names.

If the Google Cloud resources already exist and you only need to fill in the GitHub variables, start with the project ID. This must be the project ID, not the project number from the Workload Identity Provider resource name:

```bash
export PROJECT_ID="my-code-signing-project"
```

Find the Workload Identity Pool and Provider:

```bash
gcloud iam workload-identity-pools list \
  --project="$PROJECT_ID" \
  --location=global

export POOL_ID="github-actions"

gcloud iam workload-identity-pools providers list \
  --project="$PROJECT_ID" \
  --location=global \
  --workload-identity-pool="$POOL_ID"

export PROVIDER_ID="windows-code-signing"

gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location=global \
  --workload-identity-pool="$POOL_ID" \
  --format='value(name)'
```

Use the final command's output as `GCP_CODE_SIGNING_WORKLOAD_IDENTITY_PROVIDER`.

Find the signing service account:

```bash
gcloud iam service-accounts list \
  --project="$PROJECT_ID" \
  --format='table(email,displayName)'
```

Use the signing service account email as `GCP_CODE_SIGNING_SERVICE_ACCOUNT`.

Find the KMS key version:

```bash
export KMS_LOCATION="global"

gcloud kms keyrings list \
  --project="$PROJECT_ID" \
  --location="$KMS_LOCATION"

export KMS_KEYRING="codesigning"

gcloud kms keys list \
  --project="$PROJECT_ID" \
  --location="$KMS_LOCATION" \
  --keyring="$KMS_KEYRING"

export KMS_KEY="windows-code-signing"

gcloud kms keys versions list \
  --project="$PROJECT_ID" \
  --location="$KMS_LOCATION" \
  --keyring="$KMS_KEYRING" \
  --key="$KMS_KEY"
```

Choose the enabled key version whose public key matches the code-signing certificate. Then set `GCP_CODE_SIGNING_KMS_KEY_VERSION` to the full resource path:

```bash
export KMS_VERSION="2"

echo "projects/${PROJECT_ID}/locations/${KMS_LOCATION}/keyRings/${KMS_KEYRING}/cryptoKeys/${KMS_KEY}/cryptoKeyVersions/${KMS_VERSION}"
```

Do not guess the key version. If more than one version is enabled, confirm which public key was used for the certificate CSR before signing a release.

Set these repository or protected-environment secrets in every repository that is allowed to sign:

| GitHub secret | Contents |
| --- | --- |
| `GCP_CODE_SIGNING_CERTIFICATE_BASE64` | Base64-encoded leaf code-signing certificate |
| `GCP_CODE_SIGNING_INTERMEDIATE_1_BASE64` | Base64-encoded first intermediate certificate |
| `GCP_CODE_SIGNING_INTERMEDIATE_2_BASE64` | Optional base64-encoded second intermediate certificate |

These certificate files contain public certificates, not the private key. They are not confidential in the same way as a PFX file, but this workflow stores them as GitHub secrets so certificate rotation does not require a source change.

On macOS, encode each certificate and copy it to the clipboard:

```bash
base64 < code-signing.cer | tr -d '\n' | pbcopy
base64 < intermediate1.cer | tr -d '\n' | pbcopy
base64 < intermediate2.cer | tr -d '\n' | pbcopy
```

Run the commands one at a time and paste each result into its corresponding GitHub secret.

The leaf certificate must match the public key in the configured KMS key version. The intermediate files should be the chain supplied by the certificate authority. Do not place a private key, PFX, service-account JSON key, access token, or refresh token in these secrets.

## 3. Workflow behavior

`build-dispatch.yml` grants `id-token: write`, passes repository variables into the reusable `electron-build.yml` workflow, and uses `secrets: inherit`.

`test-electron-build.yml` is a pull-request workflow and explicitly passes `sign-distribution: false`. Do not grant `id-token: write` to pull-request builds that execute untrusted code.

`electron-build.yml` signs only when all of these are true:

- the runner is Windows;
- `sign-distribution` is `true`;
- all required Google Cloud signing inputs are present; and
- the required certificate secrets are present.

If none of the required Google Cloud repository variables are present, the Windows build continues unsigned. This keeps forks without signing configuration usable, even if public certificate secrets are present. If only part of the Google Cloud repository variable configuration is present, or if those variables are present but required certificate secrets are missing, the workflow fails so misconfigured production repositories do not silently publish unsigned installers.

To fail fast, the workflow checks signing configuration, parses the configured KMS key version, validates service-account impersonation, validates KMS public-key access, prepares the certificate chain, installs Java, and downloads a checksum-verified Jsign JAR immediately after checkout and before the application build. The final `google-github-actions/auth` step stays after the installer build and immediately before signing so short-lived OIDC-derived credentials are fresh when Jsign needs them.

The workflow signs the final NSIS installer at:

```text
electron/dist/<artifact-name>_<build-number>_win64.exe
```

The signing steps:

1. Check the signing configuration.
2. Parse the full KMS key-version resource into the Jsign `--keystore` and `--alias` values.
3. Run an early Google Cloud authentication preflight.
4. Confirm the configured service account can read the KMS key version's public key.
5. Decode the public certificate files into `RUNNER_TEMP` and create a PKCS#7 `.p7b` certificate-chain file for Jsign.
6. Set up Java and download the pinned Jsign JAR.
7. Build the installer.
8. Re-authenticate to Google Cloud with `google-github-actions/auth`.
9. Run `jsign` with `--storetype GOOGLECLOUD`, `--storepass env:GOOGLE_ACCESS_TOKEN`, the parsed KMS alias, and the certificate chain.
10. Run `signtool verify` before uploading the artifact.

The active workflow uses access-token outputs and does not create a Google credentials file. The backup CNG workflow can create temporary `gha-creds-*.json` files in the workspace, so `.gitignore` should include:

```text
gha-creds-*.json
```

The previous Google-documented CNG plus SignTool implementation is kept at `.github/workflows/electron-build-old.yaml`. It is not the default because Jsign avoids installing and configuring the Windows CNG provider on every GitHub-hosted runner. Keep it as a fallback because it works as-is, follows the Google-documented Windows path, and does not rely on Jsign.

## 4. Calling the reusable workflow directly

When another workflow calls `electron-build.yml` for signing, pass the same inputs and secrets. The caller must grant `id-token: write`; the called workflow should not be treated as a way to bypass caller-side permissions.

```yaml
jobs:
  windows-build:
    permissions:
      contents: read
      id-token: write
    uses: my-org/idaes-electron-build/.github/workflows/electron-build.yml@main
    with:
      os-version: windows-latest
      project: watertap
      gcp-code-signing-project-id: ${{ vars.GCP_CODE_SIGNING_PROJECT_ID }}
      gcp-code-signing-workload-identity-provider: ${{ vars.GCP_CODE_SIGNING_WORKLOAD_IDENTITY_PROVIDER }}
      gcp-code-signing-service-account: ${{ vars.GCP_CODE_SIGNING_SERVICE_ACCOUNT }}
      gcp-code-signing-kms-key-version: ${{ vars.GCP_CODE_SIGNING_KMS_KEY_VERSION }}
      jsign-version: ${{ vars.JSIGN_VERSION || '7.5' }}
      jsign-sha256: ${{ vars.JSIGN_SHA256 || '602a51c3545a6dc4fb99bd2ea7152b26d1345916d0c93ddfbd5936cb735af91c' }}
      windows-signing-timestamp-url: ${{ vars.WINDOWS_SIGNING_TIMESTAMP_URL || 'http://timestamp.digicert.com' }}
    secrets:
      GCP_CODE_SIGNING_CERTIFICATE_BASE64: ${{ secrets.GCP_CODE_SIGNING_CERTIFICATE_BASE64 }}
      GCP_CODE_SIGNING_INTERMEDIATE_1_BASE64: ${{ secrets.GCP_CODE_SIGNING_INTERMEDIATE_1_BASE64 }}
      GCP_CODE_SIGNING_INTERMEDIATE_2_BASE64: ${{ secrets.GCP_CODE_SIGNING_INTERMEDIATE_2_BASE64 }}
```

Use a protected GitHub environment for production signing if releases require approval. Environment secrets can ensure that unreviewed jobs cannot access certificate files, but the primary security boundary remains the Google Cloud OIDC provider condition and KMS IAM policy.

## Electron signing order

The current workflow signs the final installer with Jsign after `electron-builder` creates it. That matches the previous Azure signing behavior.

Signing only the final installer does not sign the executables and native libraries packaged inside it. A complete Electron release generally signs:

1. the unpacked application executable and any project-owned native `.exe` or `.dll` files that require Authenticode signatures;
2. the packaged application; and
3. the final installer.

Integrate the KMS-backed Jsign command with the Electron packager's Windows signing hook if inner application signatures become a release requirement. Do not recursively sign every third-party binary without understanding its ownership and existing signature.

## Security checklist

- Never grant a GitHub repository a service-account JSON key.
- Never store a PFX, private key, refresh token, or long-lived access token in GitHub.
- Scope `roles/cloudkms.signerVerifier` to the individual signing key, not the project.
- Restrict the Workload Identity Provider to exact repositories and, where practical, approved refs or reusable workflows.
- Add one service-account `roles/iam.workloadIdentityUser` binding per trusted repository.
- Do not allow workflows triggered by untrusted pull-request code to invoke the production signing job.
- Pin the exact KMS key version and keep obsolete versions disabled.
- Require successful SignTool verification before upload or publication.
- Keep GitHub environment approvals and protected release branches outside the control of ordinary pull requests.
- Retain Cloud Audit Logs and GitHub Actions logs for signing-event traceability.

## Rotation and renewal

When the certificate is renewed or the KMS key version changes:

1. verify that the new leaf certificate's public key matches the intended KMS key version;
2. replace the certificate secrets if the leaf or chain changed;
3. update `GCP_CODE_SIGNING_KMS_KEY_VERSION` if a new key version was used;
4. update the Workload Identity Provider condition and service-account IAM bindings if trusted repositories changed;
5. run a controlled test build and verify its Authenticode signature and timestamp; and
6. disable an old KMS key version only after no production workflow references it.

If the renewed certificate reuses the same KMS key version, the KMS resource name does not change; only the certificate material and certificate validity period change.

## Troubleshooting

| Symptom | Checks |
| --- | --- |
| OIDC authentication fails | Confirm `id-token: write`, the exact provider resource name, repository spelling and case, and the provider attribute condition. Allow several minutes after IAM changes. |
| Windows signing configuration is incomplete and missing repository variables | Add all four `GCP_CODE_SIGNING_*` repository variables, add matching repository secrets, or run the workflow with `sign-distribution: false` for an unsigned fork build. |
| Permission `iam.serviceAccounts.getAccessToken` denied | Confirm the service account has a `roles/iam.workloadIdentityUser` binding for the exact caller repository and that the Workload Identity Provider condition allows that repository. Use the GitHub repository name in `OWNER/REPO` form exactly as GitHub reports it. |
| KMS permission is denied | Confirm the service account has `roles/cloudkms.signerVerifier` on the correct key and that the configured key version is enabled. |
| Service-account impersonation is denied | Confirm the caller repository has a `roles/iam.workloadIdentityUser` binding on the service account using `principalSet://.../attribute.repository/OWNER/REPO`. |
| Jsign download fails | Confirm `JSIGN_VERSION` exists as a Jsign release and that GitHub release downloads are reachable from the runner. |
| Jsign checksum fails | Update `JSIGN_SHA256` only after intentionally changing `JSIGN_VERSION` and verifying the downloaded JAR out of band. |
| Jsign cannot find the Google Cloud key | Confirm `GCP_CODE_SIGNING_KMS_KEY_VERSION` is the full key-version resource. The workflow parses it into Jsign `--keystore projects/PROJECT/locations/LOCATION/keyRings/KEYRING` and `--alias KEY/cryptoKeyVersions/VERSION`. |
| SignTool reports a certificate/private-key mismatch | The leaf `.cer` belongs to a different public key or KMS key version. Recheck the certificate against the CSR and key version. |
| Jsign fails to load the certificate chain with `extra data at the end` | Use a workflow version that creates a PKCS#7 `.p7b` certificate-chain file instead of concatenating individual certificate files into PEM. |
| PowerShell reports `Cannot find an overload for "FromBase64String" and the argument count: "2"` | Use the current `electron-build.yml` certificate-chain step. Older versions parsed PEM bodies inline with `-replace`, which PowerShell treated as multiple .NET method arguments. |
| PowerShell reports `Cannot bind argument to parameter 'Destination' because it is an empty collection` | Use the current `electron-build.yml` certificate-chain step. Older versions passed an empty certificate collection into a mandatory function parameter; the current workflow imports certificates first, then adds them to the combined chain. |
| Certificate chain is incomplete | Confirm every CA-supplied intermediate is stored in GitHub and that the Jsign certificate-chain step reports the expected certificate count. The workflow accepts base64-encoded `.cer`, `.pem`, `.p7b`, or `.spc` certificate material and exports the combined chain as `.p7b`. |
| Signature succeeds but timestamping fails | Confirm outbound access to the timestamp service and use an RFC 3161 timestamp endpoint. Do not publish an untimestamped release. |
| Installer is signed but the installed app is not | Add signing before packaging for the inner Electron executable and relevant native binaries. |

## References

- [Jsign documentation](https://ebourg.github.io/jsign/)
- [Jsign GitHub releases](https://github.com/ebourg/jsign/releases)
- [Google Cloud: Use CNG Provider and SignTool to sign Windows artifacts](https://docs.cloud.google.com/kms/docs/reference/cng-signtool)
- [Google Cloud: Workload Identity Federation with deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
- [Google GitHub Actions authentication](https://github.com/google-github-actions/auth)
- [GitHub OIDC with reusable workflows](https://docs.github.com/actions/how-tos/secure-your-work/security-harden-deployments/oidc-with-reusable-workflows)
- [Microsoft SignTool documentation](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool)
