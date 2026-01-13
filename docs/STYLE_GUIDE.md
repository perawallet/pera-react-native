# Style Guide

This guide covers the key coding standards for the project.

## Git Workflow

### Branches

Use the format: `<your-name>/<feature-or-fix>`

```
john/add-login-screen
sarah/fix-balance-display
```

### Commits

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(accounts): add account import
fix(settings): correct currency format
docs: update readme
refactor(hooks): simplify balance hook
```

### Pull Requests

- Target `main` branch
- Ensure tests pass
- Use **Squash Merge**

## TypeScript

- **Strict mode is on** — don't disable it
- **Avoid `any`** — use `unknown` with type guards, or define proper types
- **Define return types** for exported functions

## Components

- Use **functional components** (no classes)
- Keep styles in separate `styles.ts` files
- Use **StyleSheet** or theme-based `useStyles`, not inline styles

## Code Quality

Run these before pushing:

```sh
pnpm pre-push   # Lint, format, copyright, i18n
pnpm test       # Run tests
```

If checks fail:

```sh
pnpm lint:fix   # Auto-fix lint issues
pnpm format     # Auto-fix formatting
```

## Key Principles

1. **Logic in packages, UI in mobile app**
2. **Self-documenting code** — minimize comments
3. **No magic numbers** — use named constants
4. **Consistent naming** — see [Naming Conventions](NAMING_CONVENTIONS.md)

## Learn More

For detailed code patterns and examples, see the development workflows.
