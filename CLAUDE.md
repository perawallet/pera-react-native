# Pera Wallet

React Native monorepo for Pera Wallet, a non-custodial Algorand crypto wallet. **Always use `pnpm`** for all commands.

```sh
pnpm build                          # Run to confirm no type/compile issues
pnpm pre-push --no-fail-on-error    # Run before completing any task
pnpm test                           # Run tests
pnpm --filter mobile test -t <filterpattern>        # Run only specific mobile tests
```

## Architecture

- **UI layer** (`apps/mobile`): Components, screens, navigation, styling, gestures
- **Logic layer** (`packages/*`): Data fetching, Zustand stores, business rules, API clients, crypto
- **State**: Zustand for client state, TanStack Query for server state
- Key packages: `accounts`, `assets`, `blockchain`, `settings`, `shared`, `platform-integration`

## Styling (CRITICAL)

**ALWAYS** use `makeStyles` from `@rneui/themed`. **NEVER** use `StyleSheet.create`.

- Use theme tokens only (`theme.colors.*`, `theme.spacing.*`, `theme.borders.*`) — no hardcoded colors or values
- No inline styles — all styles go in `styles.ts` next to the component
- Export `useStyles` hook from `styles.ts`

```typescript
// styles.ts
import { makeStyles } from '@rneui/themed'

type StyleProps = { variant: 'primary' | 'secondary' }

export const useStyles = makeStyles((theme, { variant }: StyleProps) => ({
    container: {
        backgroundColor:
            variant === 'primary'
                ? theme.colors.buttonPrimaryBg
                : theme.colors.layerGrayLighter,
        padding: theme.spacing.md,
    },
}))
```

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

- **Explicit return types** — define `type Use[Name]Result = {...}`, never expose dependency types (`UseQueryResult`, `UseMutationResult`, `StoreApi`)
- **Complex logic MUST be extracted** from component body into a colocated `use[ComponentName]` hook
- React Query is **REQUIRED** for all async requests; Zustand is **REQUIRED** for all local state
- Cross-domain hooks: keep in origin domain, export via barrel, import via `@modules/[domain]`

```typescript
// Explicit return type pattern
type UseAccountsQueryResult = {
    accounts: Account[]
    isLoading: boolean
    isError: boolean
    error: Error | null
    refetch: () => void
}

export const useAccountsQuery = (): UseAccountsQueryResult => {
    const query = useQuery({
        queryKey: accountQueryKeys.all,
        queryFn: fetchAccounts,
    })
    return {
        accounts: query.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch,
    }
}
```

## Zustand Stores

- Location: `packages/[domain]/src/store/store.ts`
- Use `create` with `persist` middleware; stores use `createPersistStorage` from `@perawallet/wallet-core-shared` which lazily delegates to `getProvider().keyValueStorage`
- **Granular selectors** — never destructure from `useStore()` directly
- Every store must include `resetState()` method (implements `BaseStoreState`)
- Separate `State` and `Actions` types, combine as `Store = State & Actions`

## Numbers & Precision (CRITICAL)

All monetary/financial values (amounts, balances, prices, fees) use `Decimal` from `decimal.js` as the internal representation. **Never** use JS `number` for financial amounts — it loses precision beyond 2^53.

### Import

```typescript
import { Decimal } from 'decimal.js'
```

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

Canonical functions in `@perawallet/wallet-core-blockchain`:

- `baseUnitsToDisplayUnits(amount, decimals)` → `Decimal` — e.g., microAlgos → ALGOs
- `displayUnitsToBaseUnits(amount, decimals)` → `Decimal` — e.g., ALGOs → microAlgos
- `toBigInt(decimal)` → `bigint` — for transaction building
- `algosToMicroAlgosBigInt(algos)` → `bigint` — ALGO-specific shorthand
- `microAlgosToAlgos(microAlgos)` → `Decimal` — ALGO-specific shorthand

Asset-specific wrappers in `@perawallet/wallet-core-assets`:

- `toWholeUnits(value, asset)` → `Decimal` — delegates to `baseUnitsToDisplayUnits`
- `toDecimalUnits(value, asset)` → `Decimal` — delegates to `displayUnitsToBaseUnits`

### Rules

- Domain model fields for amounts/balances/prices **MUST** be typed as `Decimal`, not `string` or `number`
- `bigint` is only used at the blockchain boundary (AlgoKit types, transaction building, balance validation)
- Always document units in JSDoc: specify whether a field is in base units or display units
- Global Decimal config (precision 40, ROUND_HALF_UP) is initialized via `initDecimalConfig()` from `@perawallet/wallet-core-shared`

## TypeScript

- `type` for props, unions, simple shapes; `interface` for data models that may be extended
- Boolean props: prefix with `is`, `has`, `can`, `should` (`isLoading`, `hasError`)
- Event handler props: `on` prefix (`onPress`); internal handlers: `handle` prefix (`handlePress`)
- **Never** use `any` — use `unknown` with type guards or define proper types
- Named exports only — no default exports

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

- **Vitest + React Native Testing Library**
- Files: `.spec.tsx` extension in `__tests__/` directory (colocated)
- Test **behavior only** — not styles or static text
- **AAA pattern**: Arrange, Act, Assert
- Import from `@test-utils/render` for `render`, `fireEvent`, `screen`
- Hook tests: use `renderHook` from `@testing-library/react`

## Work Completion

Before reporting any task complete:

1. `pnpm pre-push --no-fail-on-error` must pass
2. `pnpm test` must pass
3. Tests written for any new code
4. For major changes: `pnpm build` must pass

## Skills

Use these slash commands for guided workflows:

- `/create-component` — Create a new component with correct structure
- `/create-hook` — Create a new hook with correct naming and types
- `/create-module` — Create a new feature module with screens and navigation
- `/create-package` — Create a new business logic package
- `/verify-work` — Run pre-completion verification checks
