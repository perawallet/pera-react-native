# Style Guide

This guide covers the key coding standards for the project.

## TypeScript

- **Strict mode is on** — don't disable it
- **Avoid `any`** — use `unknown` with type guards, or define proper types
- **Define return types** for exported functions

## Components

- Use **functional components** (no classes)
- Keep styles in separate `styles.ts` files
- Use RNE theme-based `makeStyles`/`useStyles` — **never** `StyleSheet.create`

## Styling

All component styling uses React Native Elements (RNE) theming via the `makeStyles` hook. This ensures:

- Consistent theming across the app
- Automatic dark mode support
- Centralized design tokens

**Key rules:**

- Always use `makeStyles` from `@rneui/themed`
- Never use `StyleSheet.create` from `react-native`
- Use theme tokens (`theme.colors.*`, `theme.spacing.*`) — no hardcoded values
- No inline styles

For detailed patterns and examples, see `.agent/rules/code-patterns.md`.

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
3. **Theme-based styling** — always use `makeStyles` with theme tokens

## Images

| Format   | Use For                                          |
| -------- | ------------------------------------------------ |
| **SVG**  | Icons, logos, simple graphics that need to scale |
| **WebP** | Photos, complex images, screenshots              |

## Learn More

- [Architecture](ARCHITECTURE.md) - Where logic vs UI goes
- [Naming Conventions](NAMING_CONVENTIONS.md) - How to name things
- [Folder Structure](FOLDER_STRUCTURE.md) - Where to put files
