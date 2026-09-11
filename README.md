# PARETO UI

PARETO UI is the desktop user interface for the [Project PARETO](https://github.com/project-pareto/project-pareto) produced-water optimization tools. It combines a FastAPI backend, a React frontend, and an Electron desktop shell.

## Documentation

- **Start here: [Upload a map, configure a scenario, and optimize](docs/scenario-completion.md).**
  Includes a [practice KML, shapefile ZIP, and completed input workbook](examples/map-to-optimization/README.md).
- [Building and running PARETO UI](docs/building.md)
- [Network map editing and diagnostics](docs/network-map.md)
- [Optional AI settings](docs/ai-settings.md)
- [Validation and data preservation — developer reference](docs/scenario-validation.md)
- [Regression tests: coverage, commands, and limitations](docs/regression-tests.md)
- [Maintenance roadmap and implementation plans](docs/roadmap.md)
- [Windows code signing with Google Cloud KMS](docs/windows-code-signing-google-cloud-kms.md)
- [PARETO model documentation](https://pareto.readthedocs.io/en/stable/)

## Quick Start

From the repository root:

```bash
conda env create --file environment.yml
conda activate pareto-ui-env
pip install -r backend/requirements.txt
idaes get-extensions --verbose
npm --prefix electron clean-install
npm --prefix electron/ui clean-install
```

Create `electron/ui/.env` for local development:

```bash
cat > electron/ui/.env <<'EOF'
REACT_APP_PARETO_VERSION=main
REACT_APP_BUILD_NUMBER=local
EOF
```

Run in a browser:

```bash
npm --prefix electron/ui run app-start
```

Run in Electron:

```bash
npm --prefix electron/ui run electron-start
```

## Packaged Builds

Local package scripts are available from `electron/package.json`:

```bash
cd electron
npm run dist:win
npm run dist:mac
npm run dist:lin
```

Use the GitHub Actions manual workflow for release-style builds and Windows code signing:

```bash
gh workflow run app_build_dispatch.yml \
  --repo project-pareto/pareto-ui \
  --ref main \
  -f os-version=windows-latest \
  -f sign-distribution=true \
  -f windows-installer-target=nsis
```

See [Building and running PARETO UI](docs/building.md) for full build inputs and artifact names.
