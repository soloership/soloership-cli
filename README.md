# SoloerShip CLI

Package name: `create-soloership`. Independent of the SoloerShip template and sales site. Node.js 22.12+, Git (GitHub source only), and the template's pinned pnpm version are required. There are no runtime npm dependencies.

## Create a project

```sh
pnpm create soloership my-project
```

The default template repository is private. Accept repository access and configure Git authentication before running this command.

## Local template

```sh
node /path/to/soloership-cli/bin/create-soloership.mjs my-project \
  --template /path/to/soloership
```

Run from the parent directory where the new project should live, outside the template. This copies the template, names the project, installs locked dependencies, generates configuration and skill links, then invokes the template's interactive setup and starts development. The template owns mode selection, services, credentials and administrator creation.

Use `--mode saas|corporate|directory` to preselect a mode. `--no-start` stops after setup; `--no-setup` installs without setup; `--no-install` copies only and prints the remaining commands. `--yes --skip-admin --no-start` performs unattended setup without an administrator. Run `pnpm admin:create` inside the generated project afterward; no default password is assigned.

## GitHub source

```sh
node bin/create-soloership.mjs my-project --repo YOUR_ORG/YOUR_TEMPLATE --ref v1.0.0
```

`--ref` selects a branch or release tag (not a commit SHA). Without it Git uses the repository's default branch. Prefer release tags for repeatable delivery. Only HTTPS GitHub `OWNER/REPO` identifiers are accepted. Git uses the user's configured credential helper. Private repositories require accepted access and working Git authentication. For GitHub CLI users, configure Git credentials with `gh auth login` and `gh auth setup-git` before creating a project. This CLI never accepts, prints or stores tokens and does not grant repository access.

Only run trusted sources: dependency installation and template setup execute their scripts locally. The CLI does not purchase, activate licenses, deploy or create remote resources.

The default source is `soloership/soloership`. Override it with `--repo` or `SOLOERSHIP_TEMPLATE_REPO`, or use `--template` for local development. Private repository access is required; there is no silent fallback.

## Export and recovery

A root allowlist copies template source, configuration examples, migrations, skills, tests and docs. Runtime/build directories, Git history, environment secrets, database files and private-key files are excluded. Symbolic links inside exported source are rejected; project skill links are rebuilt using `skills:sync`. Credentials hard-coded into source are not detectable by file filtering: maintain a clean, reviewed template release.

New projects use local URLs, fresh resource names, preview email and disabled payments/AI. Cloud account IDs, sender addresses and model endpoints are reset. No source `.dev.vars` or local administrator/database is copied. Normal setup generates its own authentication secret.

Existing destinations are always rejected, including empty folders. Copy failures remove only the newly created target. Installation/setup failures retain project files for diagnosis and resumption. No Git repository or origin is added automatically; create your own repository when ready.

## Verification

```sh
npm run check
node scripts/smoke.mjs /absolute/path/to/soloership
npm pack --dry-run
```

The smoke test creates a temporary project, installs dependencies, initializes local D1, validates generated configuration, builds, scans assets and runs the template's fresh-install/admin-login regression. It removes the temporary project afterward. No cloud account is required.

## Release

Run `npm run check`, the template smoke test, and `npm pack --dry-run` before publishing. The npm package contains the CLI only. Publish with `npm publish --access public --registry=https://registry.npmjs.org/` using an authorized npm account.

The CLI retains its `UNLICENSED` designation; public npm distribution does not grant an open-source license or access to the private template.

## Design review

The CLI has one argument entry point and one source/export module. It delegates service configuration to the template. No second setup wizard, licensing service, plugin framework, vendored template or automatic update system is included.

Verified locally: five tests pass, including actual Git tag checkout through an isolated local transport, existing-directory protection and secret/runtime exclusion. The full smoke against the current SoloerShip template passed installation, setup, D1 migration, configuration diagnostics, typecheck, build, secret scan and fresh-project administrator login regression. `npm pack --dry-run` contains four files (CLI entry, source module, package manifest and README). Private GitHub downloads use the caller’s existing repository access. Registry publication is verified separately from local smoke tests.
