# Pera Wallet mobile app

## Styling (CRITICAL)

**ALWAYS** use `makeStyles` from `@rneui/themed`. **NEVER** use `StyleSheet.create`.

- Use theme tokens only (`theme.colors.*`, `theme.spacing.*`, `theme.borders.*`). No hardcoded colors or values
- No inline styles; all styles go in `styles.ts` next to the component
- Export `useStyles` hook from `styles.ts`

## Components (CRITICAL)

### PW-Prefix Wrapper Requirement

All external components (from `@rneui/themed`, `react-native`, third-party) **MUST** be wrapped in `PW`-prefixed components before use. These live in `apps/mobile/src/components/core/PW[Name]/`.

**ALWAYS** import core components from the barrel: `import { PWButton, PWText } from '@components/core'`

Exceptions: `ActivityIndicator`, basic layout primitives used only inside PW components.

### Component Locations

| Type            | Location                                           | Prefix          |
| --------------- | -------------------------------------------------- | --------------- |
| Design system   | `apps/mobile/src/components/core/PW[Name]/`        | `PW`            |
| Shared          | `apps/mobile/src/components/[Name]/`               | None            |
| Module-specific | `apps/mobile/src/modules/[mod]/components/[Name]/` | None            |
| Screen          | `apps/mobile/src/modules/[mod]/screens/[Name]/`    | `Screen` suffix |

### Folder Structure (Required)

```
ComponentName/              # PascalCase
├── ComponentName.tsx       # Named export only (no default exports)
├── styles.ts               # makeStyles
├── index.ts                # Barrel: export { ComponentName } and type
├── __tests__/
│   └── ComponentName.spec.tsx
└── SubComponent.tsx        # NOT re-exported, used only by parent
```

Folder naming: component folders = `PascalCase`, grouping/utility folders = `kebab-case`.

If creating a core component, update `apps/mobile/src/components/core/index.ts` barrel.

## Module Boundaries (CRITICAL)

Code outside a module reaches it only through a public entry; `pera/no-deep-module-imports` fails on
anything deeper. Tests are exempt.

| Entry               | File                 | Holds                                                                             |
| ------------------- | -------------------- | --------------------------------------------------------------------------------- |
| `@modules/x`        | `index.ts`           | Components, hooks, utils and types other features use                             |
| `@modules/x/routes` | `routes/index.ts(x)` | Navigators, screens other navigators mount, sheets that host their own navigator  |
| `@modules/x/shell`  | `shell.ts`           | What the app shell mounts once: providers, root overlays, guards, lifecycle hooks |
| `@modules/x/web`    | `web.ts`             | Web-only API; import it from `.web.ts(x)` files only                              |

- Keep `index.ts` light. Metro and vitest evaluate every re-export, so a screen or overlay in the
  barrel loads for every consumer, and in a unit test a partial package mock then throws on import.
- Name each export in an entry file rather than `export *`: the entry is the module's contract, and a
  star re-export widens it silently whenever the source grows.
- A component or hook many modules share and none owns goes in `src/components`, `src/hooks` or
  `src/utils`. Infrastructure (`components/core`, `bottom-sheet`, `security`) never imports a feature.
- The developer gallery (`settings/screens/developer`) is allow-listed; a module needing a narrower
  entry documents it in the file and in the rule's `EXTRA_ENTRIES`.
- A test that mocks a collaborator mocks the file the entry re-exports from, or the entry itself; a
  mock of some other path under the module no longer intercepts the import.
