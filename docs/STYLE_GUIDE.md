# Style Guide

This guide covers the key coding standards for the project.

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

1. **Self-documenting code** — minimize comments
2. **No magic numbers** — use named constants

## Learn More

- [Contributing Guide](CONTRIBUTING.md) - Git workflow, branching, commits
- [Architecture](docs/ARCHITECTURE.md) - Where logic vs UI goes
- [Naming Conventions](docs/NAMING_CONVENTIONS.md) - How to name things
- [Folder Structure](docs/FOLDER_STRUCTURE.md) - Where to put files
