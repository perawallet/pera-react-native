# Naming Conventions

Consistent naming makes the codebase predictable and easy to navigate.

## Files & Folders

| Type           | Convention       | Example                               |
| -------------- | ---------------- | ------------------------------------- |
| Component file | `PascalCase.tsx` | `PWButton.tsx`, `AccountCard.tsx`     |
| Hook file      | `camelCase.ts`   | `useToast.ts`, `useAccountBalance.ts` |
| Utility file   | `kebab-case.ts`  | `string-utils.ts`                     |
| Style file     | `styles.ts`      | `styles.ts` or `PWButton.styles.ts`   |
| Test file      | `*.test.ts(x)`   | `PWButton.test.tsx`                   |
| Folder         | `kebab-case`     | `account-card/`, `send-funds/`        |

## Components

| Type            | Rule            | Example                            |
| --------------- | --------------- | ---------------------------------- |
| Shared UI       | `PW` prefix     | `PWButton`, `PWCard`, `PWModal`    |
| Module-specific | No prefix       | `AccountCard`, `TransactionRow`    |
| Screen          | `Screen` suffix | `AccountsScreen`, `SettingsScreen` |

## Hooks

| Type          | Convention           | Example                    |
| ------------- | -------------------- | -------------------------- |
| Query hook    | `use[Thing]Query`    | `useAccountBalanceQuery`   |
| Mutation hook | `use[Action][Thing]` | `useCreateAccount`         |
| Store hook    | `use[Thing]`         | `useAllAccounts`           |
| UI hook       | `use[Feature]`       | `useToast`, `useClipboard` |

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
✅ PWButton.tsx           (shared component)
✅ AccountCard.tsx        (module component)
✅ AccountsScreen.tsx     (screen)
✅ useToast.ts            (hook)
✅ account-card/          (folder)
✅ isLoading              (boolean prop)
✅ onPress                (event prop)
✅ handlePress            (handler function)

❌ button.tsx             (should be PascalCase)
❌ UseToast.ts            (hooks are camelCase)
❌ AccountCard/           (folders are kebab-case)
❌ loading                (booleans need prefix)
```
