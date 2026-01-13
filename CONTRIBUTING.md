# Contributing to Pera Wallet

Welcome! We're glad you're here. This guide will help you get started with contributing to the Pera Wallet React Native project.

## Getting Started

1. **Environment Setup**: Follow the [Prerequisites and Install instructions](README.md#prerequisites) in the main README.
2. **Initialize**: Run `pnpm install` and then `pnpm run setup`. The setup command installs Git hooks that automatically handle linting and formatting.
3. **Explore**: Familiarize yourself with the [Workspace layout](README.md#workspace-layout). Business logic lives in `packages/*` and UI lives in `apps/mobile`.

## Core Values

When contributing, keep these principles in mind:

- **Reusability & Scalability**: We prioritize building flexible, reusable components and patterns to accelerate future development.
- **Clean Code**: Minimize in-code comments. Code should be self-documenting; comments should explain _why_, not _what_.
- **Quality Documentation**: Keep external documentation (like this guide and `docs/*`) accurate and up to date, but keep it concise.
- **Separation of Concerns**: Keep business logic in `packages/*` and UI in `apps/mobile`.

## Workflow & Standards

### Branching

Use the format `<your-name>/<feature-or-fix>` for branch names:

```
john/add-login-screen
sarah/fix-balance-display
```

### Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(accounts): add account import functionality
fix(settings): correct theme toggle behavior
docs: update testing guide
refactor(hooks): simplify useAccountBalance
```

### Pull Requests

- Target the `main` branch
- Ensure all tests pass (`pnpm test`)
- Ensure linting passes (`pnpm lint`)
- Use **Squash Merge** when merging
- Fill out the PR template completely

## Before Submitting

Run these checks locally:

```sh
pnpm lint           # Check for linting errors
pnpm format         # Format code
pnpm lint:copyright # Ensure copyright headers
pnpm test           # Run all tests
```

The pre-push hook will run these automatically, but it's faster to catch issues early.

## Where to Put Code

| Type                          | Location                             |
| ----------------------------- | ------------------------------------ |
| Business logic, hooks, stores | `packages/[domain]/src/`             |
| Screens, UI components        | `apps/mobile/src/`                   |
| Shared UI components          | `apps/mobile/src/components/`        |
| Feature modules               | `apps/mobile/src/modules/[feature]/` |

See [Folder Structure](docs/FOLDER_STRUCTURE.md) for detailed guidance.

## Documentation

Please update documentation when making significant changes:

- **New features**: Update relevant docs in `docs/`
- **API changes**: Update affected README files
- **New patterns**: Document in appropriate guide

## Essential Reading

Before making changes, please read:

- [Architecture & State Management](docs/ARCHITECTURE.md) — How the codebase is organized
- [Folder Structure](docs/FOLDER_STRUCTURE.md) — Where to put different types of code
- [Naming Conventions](docs/NAMING_CONVENTIONS.md) — How to name files, components, and variables
- [Style Guide](docs/STYLE_GUIDE.md) — Coding standards and patterns
- [Testing Guide](docs/TESTING.md) — How to write and run tests
- [Security Best Practices](docs/SECURITY.md) — Security considerations
- [Performance Guidelines](docs/PERFORMANCE.md) — Performance optimization

## Getting Help

If you have questions:

1. Check the documentation in `docs/`
2. Search existing issues and PRs
3. Ask in the team chat/discussion

Thank you for contributing!
