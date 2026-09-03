# Contributing to Pera Wallet

## Getting started

1. Follow the [README](README.md) for prerequisites and installation.
2. Run `pnpm install`, then `pnpm run setup` to install the Git hooks.
3. Read [Architecture](docs/ARCHITECTURE.md) before your first change; it explains the split between
   `packages/*` and `apps/mobile` that most review comments come back to.

## Branching

`<your-name>/<feature-or-fix>`:

```
john/add-login-screen
sarah/fix-balance-display
```

## Commits

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat(accounts): add account import functionality
fix(settings): correct theme toggle behavior
docs: update testing guide
refactor(hooks): simplify useAccountBalance
```

| Prefix     | For                                              |
| ---------- | ------------------------------------------------ |
| `feat`     | New features                                     |
| `fix`      | Bug fixes                                        |
| `docs`     | Documentation only                               |
| `refactor` | Code changes that don't add features or fix bugs |
| `test`     | Adding or updating tests                         |
| `chore`    | Build, tooling, or maintenance                   |

## Pull requests

Target `main`, fill out the PR template, and squash-merge. All tests must pass.

Run the checks locally first. The pre-push hook runs them anyway, but catching a failure before you
push is faster:

```sh
pnpm pre-push   # Lint, format, copyright, i18n
pnpm test       # Run all tests
```

## What reviewers look for

Business logic belongs in `packages/*` and UI in `apps/mobile`. Components and patterns should be
reusable rather than one-off. Code should say what it does on its own, with comments reserved for
the why (see [Style Guide](docs/STYLE_GUIDE.md)). Documentation should be accurate and short.

[Code Layout](docs/CODE_LAYOUT.md) answers most placement and naming questions before they become
review comments.
