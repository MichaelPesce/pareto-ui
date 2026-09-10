# Building PARETO UI

This document covers local development builds and the GitHub Actions build workflow for PARETO UI.

The parent model is pinned to a tested commit in
[backend/requirements.txt](../backend/requirements.txt). To upgrade it, change that
pin and run the [workflow regression checks](scenario-validation.md#verification)
on Linux and Windows before publishing a build.

## Repository layout

- `backend/`: FastAPI backend packaged with PyInstaller for desktop builds.
- `electron/`: Electron shell, Electron Builder config, and desktop packaging scripts.
- `electron/ui/`: React frontend.
- `.github/workflows/app_build_dispatch.yml`: manual GitHub Actions entry point for packaged builds.
- `.github/workflows/app_build.yml`: reusable workflow that performs the actual packaged build.

## Local prerequisites

- Conda or Miniforge.
- Git.
- Windows for Windows installers, macOS for macOS DMGs, and Linux for Linux packages.
- Apple signing credentials only if you are producing a signed/notarized macOS build locally.

The repository's Conda environment installs Python and Node.js. Python package dependencies are installed separately from `backend/requirements.txt`.

## First-time local setup

From the repository root:

```bash
conda env create --file environment.yml
conda activate pareto-ui-env
pip install -r backend/requirements.txt
idaes get-extensions --verbose
npm --prefix electron clean-install
npm --prefix electron/ui clean-install
```

Create a local frontend environment file:

```bash
cat > electron/ui/.env <<'EOF'
REACT_APP_PARETO_VERSION=main
REACT_APP_BUILD_NUMBER=local
EOF
```

`electron/ui/.env` is ignored by Git. `REACT_APP_PARETO_VERSION` is used by the app when linking to Project PARETO sample files, so set it to the Project PARETO branch or tag you want to test against.

## Running locally

Activate the Conda environment first:

```bash
conda activate pareto-ui-env
```

Run the backend and frontend in a browser:

```bash
npm --prefix electron/ui run app-start
```

Run the backend, frontend, and Electron shell:

```bash
npm --prefix electron/ui run electron-start
```

The frontend development server uses Create React App defaults. The backend starts with Uvicorn on port `50011`.

## Local packaged builds

The local packaged build scripts are defined in `electron/package.json`.

Windows:

```bash
cd electron
npm run dist:win
```

macOS:

```bash
cd electron
npm run dist:mac
```

Linux:

```bash
cd electron
npm run dist:lin
```

Build output is written to `electron/dist/`. The local Windows build does not use the GitHub Actions Google Cloud KMS signing flow; that signing flow runs in CI after Electron Builder creates the Windows artifact.

## GitHub Actions builds

Use `.github/workflows/app_build_dispatch.yml` for CI builds. It calls `.github/workflows/app_build.yml`, which performs setup, backend build, frontend build, packaging, optional macOS signing/notarization, optional Windows signing, and artifact upload.

Run a signed Windows NSIS build from the GitHub CLI:

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

Run an unsigned Windows build:

```bash
gh workflow run app_build_dispatch.yml \
  --repo project-pareto/pareto-ui \
  --ref main \
  -f os-version=windows-latest \
  -f sign-distribution=false \
  -f windows-installer-target=nsis
```

Run a macOS DMG build:

```bash
gh workflow run app_build_dispatch.yml \
  --repo project-pareto/pareto-ui \
  --ref main \
  -f os-version=macos-latest \
  -f project-pareto-branch=main \
  -f project-pareto-version=main \
  -f sign-distribution=true
```

Optional workflow inputs:

- `package-build-number`: overrides the generated build number. If omitted, CI uses `YY.MM.DD`.
- `project-pareto-repo`: Project PARETO repository to clone and install.
- `project-pareto-branch`: Project PARETO branch or tag to install.
- `project-pareto-version`: value embedded in the frontend for display and sample-file links.
- `windows-installer-target`: `nsis`, `portable`, or `zip`.
- `sign-distribution`: set to `false` for unsigned test builds.

Windows artifact names:

- NSIS: `PARETO-UI_<build-number>_win64_nsis.exe`
- Portable executable: `PARETO-UI_<build-number>_win64_portable.exe`
- Zip target: uploaded as the `PARETO-UI_<build-number>_win64_portable` artifact directory

macOS artifact name:

- `PARETO-UI_<build-number>_arm64.dmg`

## Windows code signing

Signed Windows builds require the Google Cloud KMS setup documented in [Windows Code Signing With Google Cloud KMS](windows-code-signing-google-cloud-kms.md).

If the signing repository variables are absent, a Windows build with `sign-distribution: true` continues unsigned. If only part of the signing configuration is present, the workflow fails early so release builds do not silently publish with a broken signing setup.
