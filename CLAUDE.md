# Pera Wallet

React Native monorepo for Pera Wallet, a non-custodial Algorand crypto wallet. **Always use `pnpm`** for all commands.

```sh
pnpm build                          # Run to confirm no type/compile issues
pnpm pre-push --no-fail-on-error    # Run before completing any task
pnpm test:unit                      # Fast tests — use this while iterating, not `pnpm test`
pnpm test                           # Full suite (unit + mobile integration) — run once at the very end of a task, not on every change
pnpm --filter mobile test:unit <path> -t <filterpattern> # Run only specific mobile tests — always pass a path too, or vitest collects (transforms + spins up jsdom for) all ~250 spec files before the name filter ever applies
```

While iterating: run only the individual test file(s) you're touching, and move on. Don't re-run `pnpm test`/`pnpm test:unit` for the whole repo after every change — save the full-repo run for the end of the task.

## Architecture

- **UI layer** (`apps/mobile`): Components, screens, navigation, styling, gestures
- **Logic layer** (`packages/*`): Data fetching, Zustand stores, business rules, API clients, crypto
- **State**: Zustand for client state, TanStack Query for server state
- **Platform layer** (`extensions/*`): storage, keystore, Ledger and device adapters, reached from packages via `getProvider()`

## Styling (CRITICAL)

**ALWAYS** use `makeStyles` from `@rneui/themed`. **NEVER** use `StyleSheet.create`.

- Use theme tokens only (`theme.colors.*`, `theme.spacing.*`, `theme.borders.*`) — no hardcoded colors or values
- No inline styles — all styles go in `styles.ts` next to the component
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

## Hooks (CRITICAL)

### Naming & Suffixes

| Type            | Suffix         | Tech           | Example                    |
| --------------- | -------------- | -------------- | -------------------------- |
| Data fetch      | `Query`        | TanStack Query | `useAccountBalancesQuery`  |
| Data mutate     | `Mutation`     | TanStack Query | `useCreateAccountMutation` |
| Local state     | `Store`        | Zustand        | `useAccountsStore`         |
| Component logic | Component name | React          | `useAccountCard`           |

### Locations

| Scope                 | Location                                                   |
| --------------------- | ---------------------------------------------------------- |
| Domain-level (shared) | `modules/[mod]/hooks/`                                     |
| Screen-specific       | Colocated: `modules/[mod]/screens/[Screen]/use[Screen].ts` |
| Component-specific    | Colocated: `[Component]/use[Component].ts`                 |

### Rules

- **Complex logic MUST be extracted** from component body into a colocated `use[ComponentName]` hook
- React Query is **REQUIRED** for all async requests; Zustand is **REQUIRED** for all local state
- Cross-domain hooks: keep in origin domain, export via barrel, import via `@modules/[domain]`
- Declare an explicit `Use[Name]QueryResult` return type; return safe defaults (`data ?? []`) rather than the raw query object

## Numbers & Precision (CRITICAL)

All monetary/financial values (amounts, balances, prices, fees) use `Decimal` from `decimal.js` as the internal representation. **Never** use JS `number` for financial amounts — it loses precision beyond 2^53.

Always use the **named import** (`{ Decimal }`), never the default import. Always construct with `new Decimal(...)`, never bare `Decimal(...)` without `new`.

### Boundary Rules

| Boundary                   | From            | To                 | How                                                                                       |
| -------------------------- | --------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| API response → app         | `string` (JSON) | `Decimal`          | Wrap in `new Decimal(...)` in transformer functions                                       |
| AlgoKit/blockchain → app   | `bigint`        | `Decimal`          | Use `microAlgosToAlgos()` or `baseUnitsToDisplayUnits()`                                  |
| App → display              | `Decimal`       | formatted `string` | Use `formatNumber`/`formatCurrency` from `@perawallet/wallet-core-shared`                 |
| App → transaction building | `Decimal`       | `bigint`           | Use `toBigInt()` or `algosToMicroAlgosBigInt()` from `@perawallet/wallet-core-blockchain` |
| App → database             | `Decimal`       | `TEXT`             | Automatic via `decimalColumn` — no manual conversion needed                               |

### Conversion Utilities

Canonical conversion helpers live in `@perawallet/wallet-core-blockchain` (`baseUnitsToDisplayUnits`, `displayUnitsToBaseUnits`, `toBigInt`, `microAlgosToAlgos`, `algosToMicroAlgosBigInt`), with asset-aware wrappers `toWholeUnits`/`toDecimalUnits` in `@perawallet/wallet-core-assets`.

### Rules

- Domain model fields for amounts/balances/prices **MUST** be typed as `Decimal`, not `string` or `number`
- `bigint` is only used at the blockchain boundary (AlgoKit types, transaction building, balance validation)
- Always document units in JSDoc: specify whether a field is in base units or display units
- Global Decimal config (precision 40, ROUND_HALF_UP) is initialized via `initDecimalConfig()` from `@perawallet/wallet-core-shared`

## TypeScript

- `type` for props, unions, simple shapes; `interface` for data models that may be extended
- Boolean props: prefix with `is`, `has`, `can`, `should` (`isLoading`, `hasError`)
- Event handler props: `on` prefix (`onPress`); internal handlers: `handle` prefix (`handlePress`)
- Named exports only — no default exports

## Comments (CRITICAL)

**The code says what. Comments say why — and only when the why isn't obvious.** Default to no comment. Most code needs none.

Write a comment only when one of these is true:

- **Non-obvious rationale** — why this approach over the obvious one, a constraint from an external system, a deliberate ordering
- **A trap** — a workaround, a footgun, something that looks wrong but is right, something that will break if changed
- **Units, ranges, encodings** that the type can't express (base units vs display units, microAlgos, seconds vs ms)

Delete or don't write:

- Restatements of the code (`// Set the loading state`, `// Map over accounts`)
- JSDoc that repeats the signature — `@param address The address`, `@returns The result`
- Banner/section dividers (`// ===== Types =====`), narration of a file's structure
- "This hook does X" on a hook already named `useX`
- Change log or process narration (`// Added for PERA-1234`, `// Previously this used…`) — that's what git is for
- Commented-out code

Sizing: one line is the norm. Three is a lot. Past that, either the code needs restructuring or the explanation belongs in `docs/`.

```typescript
// Bad — restates the code, pads with structure
/**
 * Resolves the account balance.
 * This function takes an account and returns its balance.
 * @param account The account to resolve the balance for
 * @returns The balance as a Decimal
 */

// Good — the why the reader can't derive
// Indexer returns base units as strings; wrap before any arithmetic to avoid 2^53 loss.
```

Keep JSDoc on exported package APIs where it earns its place (units, constraints, gotchas) — drop the ceremony that doesn't.

## Import Order

```typescript
// 1. React
import React, { useState, useCallback } from 'react'
// 2. Third-party
import { useQuery } from '@tanstack/react-query'
// 3. @perawallet packages
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
// 4. Path aliases (@components, @modules, @hooks, etc.)
import { PWButton } from '@components/core'
// 5. Relative imports
import { useStyles } from './styles'
```

## Testing

**Vitest + React Native Testing Library.** Files use `.spec.tsx` (`.spec.ts` for non-JSX) and live in colocated `__tests__/` folders. Use **AAA** (Arrange, Act, Assert), import `render`/`fireEvent`/`screen` from `@test-utils/render`, and use `renderHook` from `@testing-library/react` for hooks.

### What to test

| Location                                                             | Unit tests?                                                                                                                |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Hooks (`useXxx.ts`), utils, stores, transformers                     | **Yes — required.** This is where behavior lives.                                                                          |
| Core components (`apps/mobile/src/components/core/PW*/`)             | **Yes** — behavioral tests (interactions, prop wiring, conditional rendering) + one smoke test is fine.                    |
| Shared components (`apps/mobile/src/components/[Name]/`)             | **Yes** — same rules as core: behavioral + smoke OK.                                                                       |
| Module-level components & screens (`apps/mobile/src/modules/**/...`) | **No.** These are covered by integration tests in `apps/mobile/src/__integration__/`. Test the hook (`use[Name]`) instead. |

### Avoid

- Tests with no real assertion (`expect(container).toBeTruthy()` after `render()`).
- Multiple tests in the same file that all just check the same text or count renders — pick one.
- Style assertions (color, padding, fontWeight, etc.). Theme/style tokens are caught by reviews, not tests.
- Re-testing React Native primitives ("renders children", "passes testID through") on every wrapper.
- Snapshot tests.

### Hook tests are the unit-test backbone for screens

When a screen or module-level component has logic, extract it into a `useXxx` hook and test the hook. Don't test the rendered screen — the integration test exercises the rendered flow.

See `docs/TESTING.md` for the integration test harness, MSW handler factories, and flow-test patterns.

## Translations

Adding or revising a locale bundle in `apps/mobile/src/i18n/locales/`? Read `docs/I18N_TRANSLATION_GUIDE.md` first. `pnpm run lint:i18n` enforces **bidirectional** key parity against `en.json` — an extra key fails as loudly as a missing one, so never add CLDR plural categories (`_many`) that `en.json` doesn't use. The guide also records the register per locale (French is formal `vous` on purpose), the two terms that deliberately differ between bundles, and the per-language traps — Turkish suffixes must never attach to a `{{placeholder}}`.

## Work Completion

Before reporting any task complete:

1. `pnpm pre-push --no-fail-on-error` must pass
2. `pnpm test` must pass (the full suite — this is the one point in a task where the full run belongs; use `pnpm test:unit` or a single-file run for everything before this)
3. Tests written for any new code
4. For major changes: `pnpm build` must pass
