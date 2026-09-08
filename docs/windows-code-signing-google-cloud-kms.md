# Windows Code Signing With Google Cloud KMS

This guide configures PARETO UI GitHub Actions to sign Windows Electron artifacts with Jsign and Google Cloud KMS, then verify the resulting Authenticode signatures with Microsoft SignTool.

The private key stays non-exportable in Google Cloud KMS Cloud HSM. GitHub stores no service-account JSON key, PFX file, exportable private key, access token, or refresh token.

## What The Workflow Uses

This setup does not require an Azure app registration or a Google OAuth client. The GitHub Actions build uses:

- a Google Cloud KMS asymmetric signing key version that owns the private-key operation;
- a code-signing certificate whose public key matches that KMS key version;
- a dedicated Google Cloud service account used only for signing;
- a Google Cloud Workload Identity Pool and OIDC provider that trusts GitHub Actions tokens from approved repositories; and
- GitHub repository variables and secrets consumed by `.github/workflows/app_build.yml`.

## Workflow Behavior

The manual build workflow is `.github/workflows/app_build_dispatch.yml`. It grants:

```yaml
permissions:
  contents: read
  id-token: write
```

and passes signing repository variables into `.github/workflows/app_build.yml`.

Windows signing runs only when all of these are true:

- the runner is Windows;
- `sign-distribution` is `true`;
- all four Google Cloud signing identifiers are present; and
- the required certificate secrets are present.

If none of the Google Cloud signing identifiers are present, the Windows build continues unsigned. If only part of the Google Cloud configuration exists, or if the identifiers exist but required certificate secrets are missing, the workflow fails early.

The workflow signs:

- `PARETO-UI_<build-number>_win64_nsis.exe` for the `nsis` target;
- `PARETO-UI_<build-number>_win64_portable.exe` for the `portable` target; and
- every `.exe` and `.dll` under `PARETO-UI_<build-number>_win64_portable/` for the `zip` target.

After signing, the workflow verifies signatures with PowerShell Authenticode inspection and Microsoft SignTool before uploading artifacts.

## Required Values

These values are resource identifiers, not credentials. They are safe to store as GitHub repository variables, although they do disclose infrastructure names in a public repository.

Current shared PARETO UI signing resources:

| Value | Current setting |
| --- | --- |
| Google Cloud project ID | `uds-windows-development` |
| Service account ID | `pareto-github-code-signer` |
| Service account email | `pareto-github-code-signer@uds-windows-development.iam.gserviceaccount.com` |
| Workload Identity Pool ID | `pareto-github-actions` |
| Workload Identity Provider ID | `pareto-ui-windows-code-signing` |
| KMS location | `global` |
| KMS key ring | `codesigning` |
| KMS key | `globalsign-certificate-2026` |
| KMS key version | `2` |
| Full KMS key-version resource | `projects/uds-windows-development/locations/global/keyRings/codesigning/cryptoKeys/globalsign-certificate-2026/cryptoKeyVersions/2` |
| Main repository | `project-pareto/pareto-ui` |
| Currently trusted fork | `MichaelPesce/pareto-ui` |

The full Workload Identity Provider resource name is not written here because it includes the Google Cloud project number. Fetch it with:

```bash
export PROJECT_ID="uds-windows-development"
export POOL_ID="pareto-github-actions"
export PROVIDER_ID="pareto-ui-windows-code-signing"

gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="$POOL_ID" \
  --format="value(name)"
```

For the current shared setup, use:

```bash
export PROJECT_ID="uds-windows-development"
export SERVICE_ACCOUNT_ID="pareto-github-code-signer"
export SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
export POOL_ID="pareto-github-actions"
export PROVIDER_ID="pareto-ui-windows-code-signing"
export KMS_LOCATION="global"
export KMS_KEYRING="codesigning"
export KMS_KEY="globalsign-certificate-2026"
export KMS_VERSION="2"
export GCP_CODE_SIGNING_KMS_KEY_VERSION="projects/${PROJECT_ID}/locations/${KMS_LOCATION}/keyRings/${KMS_KEYRING}/cryptoKeys/${KMS_KEY}/cryptoKeyVersions/${KMS_VERSION}"
```

Future developers should not create a new Google Cloud project, KMS key ring, Workload Identity Pool, or Workload Identity Provider for routine PARETO UI signing access. Reuse the shared resources above, then either add their repository to the existing provider and service-account IAM policy, or create a separate service account if they need separate audit or permission boundaries.

Use placeholders only when creating a separate signing setup:

| Value | Example |
| --- | --- |
| GitHub repository allowed to sign | `project-pareto/pareto-ui` |
| Google Cloud project ID | `my-code-signing-project` |
| Service account ID | `github-code-signer` |
| Workload Identity Pool ID | `github-actions` |
| Workload Identity Provider ID | `pareto-ui-windows-code-signing` |
| KMS location | `global` |
| KMS key ring | `codesigning` |
| KMS key | `globalsign-certificate-2026` |
| Full KMS key-version resource | `projects/my-code-signing-project/locations/global/keyRings/codesigning/cryptoKeys/globalsign-certificate-2026/cryptoKeyVersions/2` |
| Leaf certificate file | `code-signing.cer` |
| Intermediate certificate files | `intermediate1.cer`, optionally `intermediate2.cer` |
| Jsign release | `7.5` |

Always use the fully qualified, enabled KMS key version, including `/cryptoKeyVersions/N`. Pinning the exact version prevents a disabled or unintended version from being selected.

## 1. Prepare The KMS Key And Certificate

The shared PARETO UI KMS key already exists. Skip this section for routine setup and go to [Add Or Update Trusted Repositories](#2-add-or-update-trusted-repositories).

Use this section only when creating a separate signing key or replacing the certificate-backed key. Run these commands from macOS, Linux, or Cloud Shell. Replace every placeholder before running the commands.

```bash
export PROJECT_ID="my-code-signing-project"
export KMS_LOCATION="global"
export KMS_KEYRING="codesigning"
export KMS_KEY="globalsign-certificate-2026"

gcloud auth login
gcloud config set project "$PROJECT_ID"

gcloud services enable \
  cloudkms.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  --project="$PROJECT_ID"
```

Create a key ring if one does not already exist:

```bash
gcloud kms keyrings create "$KMS_KEYRING" \
  --project="$PROJECT_ID" \
  --location="$KMS_LOCATION"
```

Create an HSM-backed asymmetric signing key if one does not already exist:

```bash
gcloud kms keys create "$KMS_KEY" \
  --project="$PROJECT_ID" \
  --location="$KMS_LOCATION" \
  --keyring="$KMS_KEYRING" \
  --purpose="asymmetric-signing" \
  --default-algorithm="rsa-sign-pkcs1-4096-sha256" \
  --protection-level="hsm"
```

Choose the algorithm required by the certificate authority. Jsign supports Elliptic Curve and RSA PKCS#1 signing keys with SHA digests for Google Cloud KMS. Do not use an RSA-PSS or raw RSA key for this workflow.

List key versions and choose the enabled version used for certificate enrollment:

```bash
gcloud kms keys versions list \
  --project="$PROJECT_ID" \
  --location="$KMS_LOCATION" \
  --keyring="$KMS_KEYRING" \
  --key="$KMS_KEY"
```

Export the selected public key when you need to compare it with the certificate or provide it during certificate enrollment:

```bash
export KMS_VERSION="2"

gcloud kms keys versions get-public-key "$KMS_VERSION" \
  --project="$PROJECT_ID" \
  --location="$KMS_LOCATION" \
  --keyring="$KMS_KEYRING" \
  --key="$KMS_KEY" \
  --public-key-format="pem" \
  --output-file="kms-public-key.pem"
```

Certificate enrollment, certificate pickup, CSR generation, and CA-specific proof-of-possession steps depend on the certificate authority and are intentionally not automated in this repository. The result needed by this workflow is:

- the full KMS key-version resource for the private-key operation;
- the leaf code-signing certificate whose public key matches that KMS key version; and
- the CA intermediate certificate chain.

Set the full KMS key-version resource:

```bash
export GCP_CODE_SIGNING_KMS_KEY_VERSION="projects/${PROJECT_ID}/locations/${KMS_LOCATION}/keyRings/${KMS_KEYRING}/cryptoKeys/${KMS_KEY}/cryptoKeyVersions/${KMS_VERSION}"
```

## 2. Add Or Update Trusted Repositories

When a new repository or fork needs signing access, update two authorization layers:

- the Workload Identity Provider condition, so Google Cloud accepts GitHub OIDC tokens from the repository; and
- the signing service account IAM policy, so the accepted repository can impersonate the service account.

For the current shared service account, set the shared values and list every trusted repo exactly as GitHub reports it:

```bash
export PROJECT_ID="uds-windows-development"
export SERVICE_ACCOUNT_ID="pareto-github-code-signer"
export SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
export POOL_ID="pareto-github-actions"
export PROVIDER_ID="pareto-ui-windows-code-signing"

GITHUB_REPOSITORIES=(
  "project-pareto/pareto-ui"
  "MichaelPesce/pareto-ui"
  "new-owner/new-fork-or-repo"
)
```

Update the provider allow list:

```bash
repo_list="$(printf "'%s'," "${GITHUB_REPOSITORIES[@]}")"
repo_list="[${repo_list%,}]"
export GITHUB_REPOSITORY_CONDITION="assertion.repository in ${repo_list}"

gcloud iam workload-identity-pools providers update-oidc "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="$POOL_ID" \
  --attribute-condition="$GITHUB_REPOSITORY_CONDITION"
```

Add a service-account impersonation binding for each trusted repo:

```bash
export POOL_NAME="$(gcloud iam workload-identity-pools describe "$POOL_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --format="value(name)")"

for repo in "${GITHUB_REPOSITORIES[@]}"; do
  gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT_EMAIL" \
    --project="$PROJECT_ID" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/${POOL_NAME}/attribute.repository/${repo}"
done
```

Verify the provider condition:

```bash
gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="$POOL_ID" \
  --format="value(attributeCondition)"
```

Confirm a GitHub repository name before adding it:

```bash
gh repo view new-owner/new-fork-or-repo --json nameWithOwner -q .nameWithOwner
```

Do not rely only on repository owner checks when personal forks are allowed to sign. Prefer exact `OWNER/REPO` names.

If GitHub Actions fails with `Permission 'iam.serviceAccounts.getAccessToken' denied`, the provider accepted the GitHub OIDC token but the matching GitHub repository is not allowed to impersonate the signing service account. Verify the service-account IAM bindings:

```bash
gcloud iam service-accounts get-iam-policy "$SERVICE_ACCOUNT_EMAIL" \
  --project="$PROJECT_ID" \
  --flatten="bindings[].members" \
  --filter="bindings.role=roles/iam.workloadIdentityUser" \
  --format="table(bindings.members)"
```

Expected members for the shared PARETO UI setup include:

```text
principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/pareto-github-actions/attribute.repository/project-pareto/pareto-ui
principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/pareto-github-actions/attribute.repository/MichaelPesce/pareto-ui
```

If a repository is missing, rerun the `add-iam-policy-binding` loop above with the full repository list.

## 3. Create A Separate Service Account Or Provider

Do not create these resources every time. Use this section only when a repository needs different audit boundaries, different allowed refs, different approvals, or a different service account from the shared PARETO UI signer.

For most future forks, [Add Or Update Trusted Repositories](#2-add-or-update-trusted-repositories) is the right path.

Create a dedicated service account for GitHub Actions signing:

```bash
export SERVICE_ACCOUNT_ID="github-code-signer"
export SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create "$SERVICE_ACCOUNT_ID" \
  --project="$PROJECT_ID" \
  --display-name="GitHub Windows code signer"
```

Grant the service account KMS signing access scoped to the specific KMS key:

```bash
gcloud kms keys add-iam-policy-binding "$KMS_KEY" \
  --project="$PROJECT_ID" \
  --location="$KMS_LOCATION" \
  --keyring="$KMS_KEYRING" \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/cloudkms.signerVerifier"
```

Create the Workload Identity Pool only when setting up a separate pool or a separate Google Cloud project. If the shared pool already exists, reuse it instead.

```bash
export POOL_ID="github-actions"

gcloud iam workload-identity-pools create "$POOL_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --display-name="GitHub Actions" \
  --description="GitHub Actions identities for release automation"
```

Create or update a GitHub OIDC provider with an exact repository allow list:

```bash
export PROVIDER_ID="pareto-ui-windows-code-signing"
export GITHUB_REPOSITORY="project-pareto/pareto-ui"
export GITHUB_REPOSITORY_CONDITION="assertion.repository == '${GITHUB_REPOSITORY}'"

gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="$POOL_ID" \
  --display-name="PARETO UI Windows code signing" \
  --issuer-uri="https://token.actions.githubusercontent.com/" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.ref=assertion.ref,attribute.job_workflow_ref=assertion.job_workflow_ref" \
  --attribute-condition="$GITHUB_REPOSITORY_CONDITION"
```

If the provider already exists, update the condition:

```bash
gcloud iam workload-identity-pools providers update-oidc "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="$POOL_ID" \
  --attribute-condition="$GITHUB_REPOSITORY_CONDITION"
```

Allow the trusted repository to impersonate the signing service account:

```bash
export POOL_NAME="$(gcloud iam workload-identity-pools describe "$POOL_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --format="value(name)")"

gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_NAME}/attribute.repository/${GITHUB_REPOSITORY}"
```

Record the provider resource name. It uses the Google Cloud project number, not the project ID:

```bash
export GCP_CODE_SIGNING_WORKLOAD_IDENTITY_PROVIDER="$(gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="$POOL_ID" \
  --format="value(name)")"

echo "$GCP_CODE_SIGNING_WORKLOAD_IDENTITY_PROVIDER"
echo "$SERVICE_ACCOUNT_EMAIL"
```

For production signing, consider a stricter provider condition after confirming the basic setup works. Examples:

```text
assertion.repository == 'project-pareto/pareto-ui' &&
assertion.ref == 'refs/heads/main'
```

```text
assertion.repository == 'project-pareto/pareto-ui' &&
assertion.job_workflow_ref == 'project-pareto/pareto-ui/.github/workflows/app_build.yml@refs/heads/main'
```

Only add branch, tag, environment, or reusable-workflow restrictions when they match the release process you actually use.

## 4. Configure GitHub Variables And Secrets

The workflow expects four non-sensitive Google Cloud identifiers as repository variables:

| GitHub variable | Contents |
| --- | --- |
| `GCP_CODE_SIGNING_PROJECT_ID` | Google Cloud project ID |
| `GCP_CODE_SIGNING_WORKLOAD_IDENTITY_PROVIDER` | Full Workload Identity Provider resource name |
| `GCP_CODE_SIGNING_SERVICE_ACCOUNT` | Signing service-account email |
| `GCP_CODE_SIGNING_KMS_KEY_VERSION` | Full KMS key-version resource name |

Optional repository variables:

| GitHub variable | Default |
| --- | --- |
| `JSIGN_VERSION` | `7.5` |
| `JSIGN_SHA256` | `602a51c3545a6dc4fb99bd2ea7152b26d1345916d0c93ddfbd5936cb735af91c` |
| `WINDOWS_SIGNING_TIMESTAMP_URL` | `http://timestamp.digicert.com` |

The reusable workflow also accepts the four `GCP_CODE_SIGNING_*` identifiers as secrets for compatibility, but prefer repository variables unless there is a specific reason to hide them.

Set variables with GitHub CLI:

```bash
export GH_REPO="project-pareto/pareto-ui"

gh variable set GCP_CODE_SIGNING_PROJECT_ID \
  --repo "$GH_REPO" \
  --body "$PROJECT_ID"

gh variable set GCP_CODE_SIGNING_WORKLOAD_IDENTITY_PROVIDER \
  --repo "$GH_REPO" \
  --body "$GCP_CODE_SIGNING_WORKLOAD_IDENTITY_PROVIDER"

gh variable set GCP_CODE_SIGNING_SERVICE_ACCOUNT \
  --repo "$GH_REPO" \
  --body "$SERVICE_ACCOUNT_EMAIL"

gh variable set GCP_CODE_SIGNING_KMS_KEY_VERSION \
  --repo "$GH_REPO" \
  --body "$GCP_CODE_SIGNING_KMS_KEY_VERSION"

gh variable set JSIGN_VERSION \
  --repo "$GH_REPO" \
  --body "7.5"

gh variable set JSIGN_SHA256 \
  --repo "$GH_REPO" \
  --body "602a51c3545a6dc4fb99bd2ea7152b26d1345916d0c93ddfbd5936cb735af91c"

gh variable set WINDOWS_SIGNING_TIMESTAMP_URL \
  --repo "$GH_REPO" \
  --body "http://timestamp.digicert.com"
```

The workflow stores public certificate material as repository secrets so certificate rotation does not require source changes:

| GitHub secret | Contents |
| --- | --- |
| `GCP_CODE_SIGNING_CERTIFICATE_BASE64` | Base64-encoded leaf code-signing certificate |
| `GCP_CODE_SIGNING_INTERMEDIATE_1_BASE64` | Base64-encoded first intermediate certificate |
| `GCP_CODE_SIGNING_INTERMEDIATE_2_BASE64` | Optional base64-encoded second intermediate certificate |

Set certificate secrets from macOS or Linux:

```bash
export LEAF_CERT_PATH="code-signing.cer"
export INTERMEDIATE_1_CERT_PATH="intermediate1.cer"
export INTERMEDIATE_2_CERT_PATH="intermediate2.cer"

base64 < "$LEAF_CERT_PATH" | tr -d '\n' | \
  gh secret set GCP_CODE_SIGNING_CERTIFICATE_BASE64 --repo "$GH_REPO" --app actions

base64 < "$INTERMEDIATE_1_CERT_PATH" | tr -d '\n' | \
  gh secret set GCP_CODE_SIGNING_INTERMEDIATE_1_BASE64 --repo "$GH_REPO" --app actions

base64 < "$INTERMEDIATE_2_CERT_PATH" | tr -d '\n' | \
  gh secret set GCP_CODE_SIGNING_INTERMEDIATE_2_BASE64 --repo "$GH_REPO" --app actions
```

If there is no second intermediate certificate, skip `GCP_CODE_SIGNING_INTERMEDIATE_2_BASE64`.

PowerShell alternative:

```powershell
$GhRepo = "project-pareto/pareto-ui"
$LeafCertPath = "code-signing.cer"
$Intermediate1CertPath = "intermediate1.cer"
$Intermediate2CertPath = "intermediate2.cer"

[Convert]::ToBase64String([IO.File]::ReadAllBytes($LeafCertPath)) |
  gh secret set GCP_CODE_SIGNING_CERTIFICATE_BASE64 --repo $GhRepo --app actions

[Convert]::ToBase64String([IO.File]::ReadAllBytes($Intermediate1CertPath)) |
  gh secret set GCP_CODE_SIGNING_INTERMEDIATE_1_BASE64 --repo $GhRepo --app actions

[Convert]::ToBase64String([IO.File]::ReadAllBytes($Intermediate2CertPath)) |
  gh secret set GCP_CODE_SIGNING_INTERMEDIATE_2_BASE64 --repo $GhRepo --app actions
```

Do not put private keys, PFX files, service-account JSON keys, access tokens, refresh tokens, or certificate-authority portal credentials in GitHub secrets.

## 5. Test A Signed Build

Trigger the manual workflow:

```bash
gh workflow run app_build_dispatch.yml \
  --repo project-pareto/pareto-ui \
  --ref main \
  -f os-version=windows-latest \
  -f project-pareto-repo=project-pareto/project-pareto \
  -f project-pareto-branch=main \
  -f project-pareto-version=main \
  -f sign-distribution=true \
  -f windows-installer-target=nsis
```

Watch the run:

```bash
gh run watch --repo project-pareto/pareto-ui
```

The workflow fails before the expensive application build if OIDC, service-account impersonation, KMS public-key access, certificate-chain preparation, or Jsign download verification is misconfigured.

## 6. Rotation And Renewal

When the certificate is renewed or the KMS key version changes:

1. Verify that the new leaf certificate public key matches the intended KMS key version.
2. Replace certificate secrets if the leaf certificate or intermediate chain changed.
3. Update `GCP_CODE_SIGNING_KMS_KEY_VERSION` if a new key version was used.
4. Update the Workload Identity Provider condition and service-account IAM bindings if trusted repositories changed.
5. Run a controlled signed build and verify the Authenticode signature and timestamp.
6. Disable an old KMS key version only after no production workflow references it.

If the renewed certificate reuses the same KMS key version, the KMS resource name does not change; only the certificate material and validity period change.

## Security Checklist

- Do not create or store a service-account JSON key for GitHub Actions.
- Scope `roles/cloudkms.signerVerifier` to the individual signing key, not the project.
- Restrict the Workload Identity Provider to exact repositories and, where practical, approved refs or reusable workflows.
- Add `roles/iam.workloadIdentityUser` only for trusted repositories.
- Do not allow untrusted pull-request workflows to invoke production signing.
- Pin the exact KMS key version.
- Keep obsolete KMS key versions disabled.
- Require successful SignTool verification before publication.
- Retain Cloud Audit Logs and GitHub Actions logs for signing-event traceability.

## Troubleshooting

| Symptom | Checks |
| --- | --- |
| OIDC authentication fails | Confirm `id-token: write`, the exact provider resource name, repository spelling and case, and the provider attribute condition. Allow several minutes after IAM changes. |
| Windows signing configuration is incomplete | Add all four `GCP_CODE_SIGNING_*` repository variables, add matching certificate secrets, or run the workflow with `sign-distribution=false`. |
| `iam.serviceAccounts.getAccessToken` is denied | Confirm the provider condition allows the exact caller repository and that the service account has a `roles/iam.workloadIdentityUser` binding for that repository using the full pool resource name. This is a service-account impersonation problem, not a KMS permission problem. |
| KMS permission is denied | Confirm the service account has `roles/cloudkms.signerVerifier` on the correct key and that the configured key version is enabled. |
| Jsign checksum fails | Update `JSIGN_SHA256` only after intentionally changing `JSIGN_VERSION` and verifying the downloaded JAR out of band. |
| Jsign cannot find the Google Cloud key | Confirm `GCP_CODE_SIGNING_KMS_KEY_VERSION` is the full key-version resource. The workflow parses it into Jsign `--keystore projects/PROJECT/locations/LOCATION/keyRings/KEYRING` and `--alias KEY/cryptoKeyVersions/VERSION`. |
| SignTool reports a certificate/private-key mismatch | The leaf certificate belongs to a different public key or KMS key version. Recheck the certificate against the CSR and configured key version. |
| Certificate chain is incomplete | Confirm every CA-supplied intermediate is stored in GitHub and that the Jsign certificate-chain step reports the expected certificate count. |
| Timestamping fails | Confirm outbound access to the timestamp service and use an RFC 3161 timestamp endpoint. Do not publish an untimestamped release. |
| Installer is signed but the installed app is not | The `nsis` and `portable` targets sign the final artifact after packaging. Add pre-packaging signing if inner Electron executable signatures become a release requirement. |

## References

- [PARETO UI build workflow](../.github/workflows/app_build.yml)
- [PARETO UI manual build dispatch workflow](../.github/workflows/app_build_dispatch.yml)
- [Google Cloud Workload Identity Federation with deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
- [Google Cloud KMS Jsign guide](https://docs.cloud.google.com/kms/docs/reference/pkcs11-jsign)
- [Google GitHub Actions authentication](https://github.com/google-github-actions/auth)
- [Jsign documentation](https://ebourg.github.io/jsign/)
- [GitHub CLI `gh variable set`](https://cli.github.com/manual/gh_variable_set)
- [GitHub CLI `gh secret set`](https://cli.github.com/manual/gh_secret_set)
