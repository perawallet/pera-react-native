# Pera Wallet mobile app

## Styling (CRITICAL)

**ALWAYS** use `makeStyles` from `@rneui/themed`. **NEVER** use `StyleSheet.create`.

- Use theme tokens only (`theme.colors.*`, `theme.spacing.*`, `theme.borders.*`). No hardcoded colors or values
- No inline styles; all styles go in `styles.ts` next to the component
- `makeStyles` is only called in `styles.ts` (or a platform twin such as `styles.web.ts`); export `useStyles` for the folder's main component and `use<Name>Styles` for any other. `pera/make-styles-location` enforces this

## Components (CRITICAL)

### PW-Prefix Wrapper Requirement

All external components (from `@rneui/themed`, `react-native`, third-party) **MUST** be wrapped in `PW`-prefixed components before use. These live in `apps/mobile/src/components/core/PW[Name]/`.

**ALWAYS** import core components from the barrel: `import { PWButton, PWText } from '@components/core'`. `no-restricted-imports` fails a `@components/core/<subpath>` import outside `components/core` (tests exempt); files inside it import siblings by subpath, because a barrel import there would import itself.

Exception: basic layout primitives used only inside PW components. Loading spinners are `PWLoadingIndicator`.

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
└── SubComponent/           # Own folder (same shape); NOT re-exported, used only by parent
```

Folder naming: component folders = `PascalCase`, grouping/utility folders = `kebab-case`.

One component per `.tsx` (`react/no-multi-comp`): a second component moves to its own `Name/` folder beside the file that uses it.

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
- A chain's own UI (`modules/algorand`, `modules/ethereum`) is the only app code that reads that
  chain's transaction shapes or imports its chain package; everything else passes
  `TransactionNative` through opaque. Each such module is listed in `CHAIN_UI_MODULES`
  (`lanekeep/shared/chain-package-allowlist.ts`). A chain UI module whose chain package metro can
  stub keeps its `chain-ui.ts` in `EVM_CHAIN_MODULES` (`metro-build-gates.js`) with a
  `.stub.ts` beside it, or that package lands in every bundle.
  A feature reaches a chain's UI through `chainUiFor(family)` from `@modules/chain-ui`: one entry
  per family, one slot per feature. The feature owns its slot's type and what renders when a family
  has none.
- A test that mocks a collaborator mocks the file the entry re-exports from, or the entry itself; a
  mock of some other path under the module no longer intercepts the import.
