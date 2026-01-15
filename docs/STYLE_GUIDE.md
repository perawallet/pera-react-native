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

### Why RNE?

**Decision:** Maintain React Native Elements (RNE) as the primary UI and styling library.

**Alternatives Considered:** Unistyles, NativeWind (Tailwind).

**Reasoning:**

- **Component Ecosystem:** Unlike pure styling engines (Unistyles/NativeWind), RNE provides complex, pre-built components (e.g., BottomSheets, Tabs, Accordions) out of the box.
- **Maintenance Overhead:** Migrating to a pure styling engine would require building and maintaining these core components from scratch, significantly increasing our maintenance burden.

For detailed patterns and examples, see `.agent/rules/code-patterns.md`.

## External Component Wrappers (Design System)

`PW*` components form the app's **design system** — they wrap external dependencies and provide a consistent, project-specific API.

All components from external dependencies **must be wrapped** before use:

- Components from `@rneui/themed` → Wrap in `PW*` components
- Components from `react-native` → Wrap common ones (`TouchableOpacity`, etc.)
- Third-party components → Always wrap before use

**Key rules:**

- Design system location: `apps/mobile/src/components/core/PW[ComponentName]/`
- Define a clean, project-specific props interface
- Never import external components directly in screens or modules

For detailed patterns and examples, see `.agent/rules/component-patterns.md`.

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
