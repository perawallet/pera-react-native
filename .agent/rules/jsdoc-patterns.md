---
trigger: always_on
---

# JSDoc Patterns

JSDoc comments are **REQUIRED** for public APIs. They provide IDE intellisense, documentation generation, and code clarity.

## When to Use JSDoc

| Element               | JSDoc Required | Example Use Case                          |
| --------------------- | -------------- | ----------------------------------------- |
| Exported functions    | ✅ Yes         | Utility functions, API calls              |
| Exported hooks        | ✅ Yes         | Custom hooks                              |
| Exported components   | ✅ Yes         | Component purpose and props               |
| Exported types/interfaces | ✅ Yes     | Data models, prop types                   |
| Complex internal logic | ⚠️ When needed | Non-obvious algorithms                   |
| Simple internal code  | ❌ No          | Self-explanatory private functions        |

## Component JSDoc

```typescript
/**
 * A themed button component with loading and disabled states.
 *
 * @example
 * <PWButton
 *   variant="primary"
 *   title="Submit"
 *   onPress={handleSubmit}
 *   isLoading={isSubmitting}
 * />
 */
export const PWButton = ({
    variant,
    title,
    isLoading = false,
    isDisabled = false,
    onPress,
}: PWButtonProps) => {
    // ...
}
```

## Hook JSDoc

```typescript
/**
 * Fetches account balances for a given address.
 *
 * @param address - The wallet address to fetch balances for
 * @returns Account balance data and loading state
 *
 * @example
 * const { balances, isLoading } = useAccountBalancesQuery('ALGO...')
 */
export const useAccountBalancesQuery = (
    address: string
): UseAccountBalancesQueryResult => {
    // ...
}
```

## Type/Interface JSDoc

```typescript
/**
 * Represents a wallet account in the application.
 */
interface WalletAccount {
    /** Unique identifier for the account */
    id: string
    /** Algorand address */
    address: string
    /** User-defined account name */
    name: string
    /** Type of account (standard, multisig, ledger) */
    type: AccountType
}

/**
 * Props for the AccountCard component.
 */
type AccountCardProps = {
    /** The account to display */
    account: WalletAccount
    /** Whether this account is currently selected */
    isSelected?: boolean
    /** Callback when the card is pressed */
    onPress?: () => void
}
```

## Function JSDoc

```typescript
/**
 * Formats an Algorand address for display.
 *
 * @param address - Full Algorand address
 * @param length - Number of characters to show at start/end
 * @returns Truncated address (e.g., "ALGO...XYZ")
 *
 * @example
 * formatAddress('ALGORAND123...XYZ789', 4) // Returns 'ALGO...Z789'
 */
export const formatAddress = (address: string, length = 6): string => {
    // ...
}
```

## Mutation Hook JSDoc

```typescript
/**
 * Creates a new account in the wallet.
 *
 * @returns Mutation handler and state for account creation
 *
 * @example
 * const { createAccount, isLoading } = useCreateAccountMutation()
 * createAccount({ name: 'My Account', type: 'standard' })
 */
export const useCreateAccountMutation = (): UseCreateAccountMutationResult => {
    // ...
}
```

## Store Hook JSDoc

```typescript
/**
 * Accesses the currently selected account from the accounts store.
 *
 * @returns The currently selected account, or null if none selected
 *
 * @example
 * const selectedAccount = useSelectedAccount()
 */
export const useSelectedAccount = (): WalletAccount | null => {
    return useStore(state => state.selectedAccount)
}
```

## Anti-Patterns

```typescript
// ❌ BAD: Redundant JSDoc that just repeats the code
/**
 * Returns the account.
 * @returns The account
 */
export const getAccount = (): Account => account

// ❌ BAD: JSDoc on simple internal functions
/** Increments count by one */
const increment = () => setCount(c => c + 1)

// ❌ BAD: Missing @param or @returns on complex function
/**
 * Validates the transaction.
 */
export const validateTransaction = (tx: Transaction, rules: Rule[]): ValidationResult => { ... }

// ✅ GOOD: Descriptive and complete
/**
 * Validates a transaction against a set of rules.
 *
 * @param tx - The transaction to validate
 * @param rules - Validation rules to apply
 * @returns Validation result with errors if any
 */
export const validateTransaction = (tx: Transaction, rules: Rule[]): ValidationResult => { ... }
```

## Key Principles

1. **Document the "why"**, not the "what" — code shows what, docs explain why
2. **Use `@example`** for non-trivial usage patterns
3. **Use `@param`** for all function parameters
4. **Use `@returns`** when the return value isn't obvious from the type
5. **Keep it concise** — brief descriptions are better than novels
6. **Inline comments** (`/** */`) for type properties, not separate comments

## Common Tags Reference

| Tag        | Usage                                       |
| ---------- | ------------------------------------------- |
| `@param`   | Document function parameters                |
| `@returns` | Document return value                       |
| `@example` | Show usage examples                         |
| `@throws`  | Document exceptions that may be thrown      |
| `@see`     | Reference related functions/docs            |
| `@deprecated` | Mark as deprecated with migration path   |
