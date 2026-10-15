# Contributing

Work goes to `dev` through a pull request; `main` only receives releases.

## Quick path

1. Branch from `dev`: `<type>/<issue#>-<slug>`, for example `fix/12-squad-pane-ratio`.
2. Make the change and commit it with [Conventional Commits](https://www.conventionalcommits.org/).
3. Bump the version of every plugin you touched (see Versioning).
4. Run the checks below, then open a pull request to `dev`.

## Branches and channels

| Branch | What it is | Marketplace |
|--------|------------|-------------|
| `main` | Released versions | `squad-herdr` (`.claude-plugin/marketplace.json`) |
| `dev` | The next release, integrated | `squad-herdr-dev` (`channels/dev/marketplace.json`) |

## Commits

The scope is the plugin the commit changes: `feat(squad): ...`, `fix(cache-clock): ...`. Changes to the marketplace files use `marketplace`; `ci`, `docs` and `chore` commits that touch no plugin take no scope. release-please builds each plugin's changelog from these messages.

## Versioning

- The version lives in each plugin's `.claude-plugin/plugin.json`, and only there. A marketplace entry never carries a version.
- Every pull request to `dev` bumps each plugin it touches to a prerelease of the next version: `0.2.0-dev.1`, then `0.2.0-dev.2`, and so on.
- release-please sets the final version (`0.2.0`) on `main`, in the release pull request, and writes the plugin's `CHANGELOG.md`.

## Checks

CI runs these on every push and pull request to `dev` and `main`, with a pinned Claude Code version. Run them before you push:

```bash
claude plugin validate --strict .
claude plugin validate --strict channels/dev/marketplace.json
for plugin in plugins/*/; do claude plugin validate --strict "$plugin"; done
shellcheck plugins/squad/scripts/*.sh
```

`--strict` fails on any warning, so a plugin.json needs `name`, `version`, `description` and `author`.

## Vendored code

`plugins/token-weather` is vendored from claude-code-playground under Apache-2.0. Leave its files as they are: the release process only sets the `version` field of its plugin.json and writes its `CHANGELOG.md`. A change to the mod itself belongs upstream.
