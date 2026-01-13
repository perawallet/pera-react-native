# Contributing to Pera Wallet

Welcome! We're glad you're here. This guide will help you get started with contributing to the Pera Wallet React Native project.

## Getting Started

1. **Setup**: Follow the [README](README.md) for prerequisites and installation
2. **Initialize**: Run `pnpm install` then `pnpm run setup` (installs Git hooks)
3. **Explore**: Read [Architecture](docs/ARCHITECTURE.md) to understand the codebase

## Core Values

- **Reusability** — Build flexible, reusable components and patterns
- **Clean Code** — Self-documenting code; comments explain _why_, not _what_
- **Concise Docs** — Keep documentation accurate but brief
- **Separation** — Business logic in `packages/*`, UI in `apps/mobile`

## Branching

Use the format `<your-name>/<feature-or-fix>`:

```
john/add-login-screen
sarah/fix-balance-display
```

## Commits

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(accounts): add account import functionality
fix(settings): correct theme toggle behavior
docs: update testing guide
refactor(hooks): simplify useAccountBalance
```

Common prefixes:

| Prefix     | Use For                                          |
| ---------- | ------------------------------------------------ |
| `feat`     | New features                                     |
| `fix`      | Bug fixes                                        |
| `docs`     | Documentation only                               |
| `refactor` | Code changes that don't add features or fix bugs |
| `test`     | Adding or updating tests                         |
| `chore`    | Build, tooling, or maintenance                   |

## Pull Requests

- Target the `main` branch
- Ensure all tests pass
- Use **Squash Merge** when merging
- Fill out the PR template

## Before Submitting

Run these checks locally:

```sh
pnpm pre-push   # Lint, format, copyright, i18n
pnpm test       # Run all tests
```

The pre-push hook runs these automatically, but catching issues early is faster.

## Essential Reading

Before making changes, review the documentation in [docs/](docs/):

- **Architecture** — Understand packages vs mobile app separation
- **Folder Structure** — Know where to put different types of code
- **Naming Conventions** — Follow consistent naming patterns

## Getting Help

If you have questions:

1. Check the documentation in `docs/`
2. Search existing issues and PRs
3. Ask in the team chat/discussion

Thank you for contributing!
