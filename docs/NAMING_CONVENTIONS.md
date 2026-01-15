# Naming Conventions

Consistent naming makes the codebase predictable and easy to navigate.

## Files & Folders

| Type             | Convention       | Example                                        |
| ---------------- | ---------------- | ---------------------------------------------- |
| Component file   | `PascalCase.tsx` | `PWButton.tsx`, `AccountCard.tsx`              |
| Hook file        | `camelCase.ts`   | `useToast.ts`, `useAccountBalance.ts`          |
| Utility file     | `kebab-case.ts`  | `string-utils.ts`                              |
| Style file       | `styles.ts`      | `styles.ts` (always this exact name)           |
| Test file        | `*.spec.tsx`     | `PWButton.spec.tsx`                            |
| Component folder | `PascalCase`     | `PWButton/`, `AccountCard/`, `SettingsScreen/` |
| Grouping folder  | `kebab-case`     | `signing/`, `market/`, `hooks/`                |

### Component Folders vs Grouping Folders

**Component folders** contain a single component and its related files:

```
PWButton/           ← PascalCase
├── PWButton.tsx
├── styles.ts
└── index.ts
```

**Grouping folders** organize multiple related components or non-component code:

```
signing/            ← kebab-case (grouping folder)
├── BalanceImpactView/    ← PascalCase (component folder)
└── TransactionSigningView/  ← PascalCase (component folder)
```

## Components

| Type            | Rule            | Example                           |
| --------------- | --------------- | --------------------------------- |
| Shared UI       | `PW` prefix     | `PWButton`, `PWCard`, `PWModal`   |
| Module-specific | No prefix       | `AccountCard`, `TransactionRow`   |
| Screen          | `Screen` suffix | `AccountScreen`, `SettingsScreen` |

## Screens

Screens follow the same folder structure as components:

```
screens/
├── AccountScreen/          # PascalCase
│   ├── AccountScreen.tsx
│   ├── styles.ts
│   └── index.ts
└── SettingsScreen/         # PascalCase
    ├── SettingsScreen.tsx
    ├── styles.ts
    └── index.ts
```

## Hooks

All hooks use `camelCase` with `use` prefix.

| Type               | Convention                 | Example                      |
| ------------------ | -------------------------- | ---------------------------- |
| Query hook         | `use[Thing]Query`          | `useAccountBalanceQuery`     |
| Mutation hook      | `use[Action][Thing]Mutation` | `useCreateAccountMutation` |
| Store hook         | `use[Thing]Store`          | `useAccountsStore`           |
| Component logic    | `use[ComponentName]`       | `useAccountCard`             |
| Screen logic       | `use[ScreenName]`          | `useAccountScreen`           |

**Technology Requirements:**
- **React Query**: REQUIRED for all async requests (API calls)
- **Zustand**: REQUIRED for all local application state


## Variables & Props

| Type                     | Convention                          | Example                              |
| ------------------------ | ----------------------------------- | ------------------------------------ |
| Boolean prop             | `is`, `has`, `can`, `should` prefix | `isLoading`, `hasError`, `canSubmit` |
| Event handler (prop)     | `on` prefix                         | `onPress`, `onSubmit`, `onChange`    |
| Event handler (internal) | `handle` prefix                     | `handlePress`, `handleSubmit`        |
| Constant                 | `UPPER_SNAKE_CASE`                  | `MAX_RETRIES`, `API_URL`             |

## TypeScript Types

```typescript
// Types for component props
type ButtonProps = { ... }

// Interfaces for data models
interface WalletAccount { ... }

// Type for unions
type LoadingState = 'idle' | 'loading' | 'success' | 'error'
```

## Quick Examples

```
✅ PWButton/              (component folder - PascalCase)
✅ PWButton.tsx           (shared component)
✅ AccountCard.tsx        (module component)
✅ AccountScreen/         (screen folder - PascalCase)
✅ AccountScreen.tsx      (screen file)
✅ PWButton.spec.tsx      (test file)
✅ useAccountsQuery.ts    (query hook)
✅ useCreateAccountMutation.ts (mutation hook)
✅ useAccountsStore.ts    (store hook)
✅ useAccountCard.ts      (component logic hook)
✅ signing/               (grouping folder - kebab-case)
✅ isLoading              (boolean prop)
✅ onPress                (event prop)
✅ handlePress            (handler function)

❌ button.tsx             (should be PascalCase)
❌ UseToast.ts            (hooks are camelCase)
❌ pw-button/             (component folders should be PascalCase)
❌ PWButton.test.tsx      (tests should use .spec.tsx)
❌ loading                (booleans need prefix)
❌ settings-screen/       (screen folders should be PascalCase)
❌ useAccountBalance.ts   (query hooks need Query suffix)
❌ useCreateAccount.ts    (mutation hooks need Mutation suffix)
❌ useAccounts.ts         (store hooks need Store suffix)
```

## Learn More

For detailed patterns and code examples, see `.agent/rules/component-patterns.md`.
