# Naming Conventions

This document defines the naming conventions used throughout the project. Consistent naming improves code readability and maintainability.

## General Rules

| Element            | Convention                        | Example                                 |
| ------------------ | --------------------------------- | --------------------------------------- |
| Variables          | `camelCase`                       | `accountBalance`, `isLoading`           |
| Functions          | `camelCase`                       | `fetchBalance()`, `formatCurrency()`    |
| Constants          | `UPPER_SNAKE_CASE`                | `MAX_RETRIES`, `API_URL`                |
| Classes            | `PascalCase`                      | `AccountService`, `WalletStore`         |
| Interfaces/Types   | `PascalCase`                      | `WalletAccount`, `AccountsState`        |
| React Components   | `PascalCase`                      | `AccountCard`, `PWButton`               |
| Hooks              | `useCamelCase`                    | `useAllAccounts`, `useTheme`            |
| Files (components) | `PascalCase.tsx`                  | `AccountCard.tsx`, `PWButton.tsx`       |
| Files (utilities)  | `kebab-case.ts` or `camelCase.ts` | `query-client.ts`, `format.ts`          |
| Directories        | `kebab-case`                      | `account-card/`, `test-utils/`          |
| Test files         | `*.test.ts(x)` or `*.spec.ts(x)`  | `useAllAccounts.test.ts`                |
| Style files        | `styles.ts` or `*.styles.ts`      | `styles.ts`, `SettingsScreen.styles.ts` |

---

## Component Naming

### UI Components (apps/mobile)

All shared UI components are prefixed with `PW` (Pera Wallet) to distinguish them from third-party components:

```typescript
// ✅ GOOD
PWButton
PWCard
PWListItem
PWTouchableOpacity

// ❌ BAD
Button // Conflicts with library components
CustomButton // Inconsistent prefix
```

### Screen Components

Screens are suffixed with `Screen`:

```typescript
// ✅ GOOD
SettingsScreen
AccountsScreen
TransactionDetailScreen

// ❌ BAD
Settings // Unclear it's a screen
SettingsPage // Inconsistent suffix
SettingsView // Inconsistent suffix
```

### Module-Specific Components

Module components don't need the `PW` prefix:

```typescript
// In modules/accounts/components/
AccountCard // Clear context from location
AccountList
AccountAvatar

// In modules/settings/components/
AppVersion
SettingsRow
```

---

## Hook Naming

### Pattern: `use[Domain][Action]`

```typescript
// Query hooks (fetching data)
useAccountBalancesQuery
useAssetDetailsQuery
useTransactionHistoryQuery

// Mutation hooks (modifying data)
useCreateAccount
useUpdateAccount
useRemoveAccountById

// Store hooks (accessing state)
useAllAccounts
useSelectedAccount
useSettingsStore

// UI hooks (UI concerns)
useTheme
useToast
useModalState
```

### Hook File Naming

```
useAccountBalancesQuery.ts     // Single hook per file
querykeys.ts                   // Query key definitions
endpoints.ts                   // API endpoint definitions
index.ts                       // Public exports
```

---

## File Organization

### Component Folder Structure

```
button/
├── PWButton.tsx       # Main component
├── styles.ts          # Styles
└── __tests__/         # Tests (optional)
    └── PWButton.test.tsx

# OR for screens with dedicated styles:
screens/
├── SettingsScreen.tsx
├── SettingsScreen.styles.ts
```

### Package File Structure

```
src/
├── hooks/
│   ├── useXxxQuery.ts
│   ├── useXxxMutation.ts
│   └── index.ts
├── models/
│   ├── types.ts           # Main types
│   └── index.ts
├── store/
│   ├── store.ts           # Store implementation
│   └── index.ts
├── constants.ts
├── errors.ts
├── utils.ts
└── index.ts               # Package public API
```

---

## TypeScript Types

### Interfaces vs Types

Use `type` for most cases; use `interface` when extending is expected:

```typescript
// ✅ Prefer type for simple definitions
type AccountId = string
type AccountType = 'standard' | 'multisig' | 'ledger'

// ✅ Use interface when extending is expected
interface WalletAccount {
    id: string
    address: string
    name: string
}

interface StandardAccount extends WalletAccount {
    type: 'standard'
    canSign: true
}
```

### Props Types

```typescript
// ✅ GOOD: Named export type
export type PWButtonProps = {
    variant: 'primary' | 'secondary'
    title: string
    onPress?: () => void
}

// ❌ BAD: Inline props
const PWButton = (props: { variant: string; title: string }) => {}
```

### State Types

```typescript
// ✅ GOOD: Separate state and actions
interface AccountsState {
    accounts: WalletAccount[]
    selectedAccountAddress: string | null
    setAccounts: (accounts: WalletAccount[]) => void
    setSelectedAccountAddress: (address: string | null) => void
}
```

---

## Boolean Naming

Prefix boolean variables and props with `is`, `has`, `should`, `can`:

```typescript
// ✅ GOOD
isLoading
isValid
hasError
hasAccounts
shouldRefetch
canSign
isModalOpen

// ❌ BAD
loading // Unclear type
valid // Unclear type
error // Could be boolean or Error object
```

---

## Event Handler Naming

Use `handle[Event]` for handlers and `on[Event]` for props:

```typescript
// ✅ GOOD
type ButtonProps = {
    onPress: () => void      // Prop name
    onLongPress?: () => void
}

const MyComponent = ({ onPress }: ButtonProps) => {
    const handlePress = () => {  // Handler name
        // Do something
        onPress()
    }

    return <Button onPress={handlePress} />
}
```

---

## Test Naming

### Test Files

```
useAllAccounts.test.ts        # Unit tests
AccountCard.test.tsx          # Component tests
AccountCard.spec.tsx          # Also valid (spec = specification)
```

### Test Descriptions

Use clear, behavior-focused descriptions:

```typescript
// ✅ GOOD
describe('useAllAccounts', () => {
    test('returns all accounts from store', () => {})
    test('returns empty array when store is empty', () => {})
})

// ❌ BAD
describe('useAllAccounts', () => {
    test('works', () => {})
    test('test1', () => {})
})
```

---

## Import Aliases

The mobile app uses path aliases configured in `babel.config.js`:

```typescript
// ✅ GOOD: Use aliases
import PWButton from '@components/button/PWButton'
import { useTheme } from '@hooks/theme'
import { render } from '@test-utils'

// ❌ BAD: Relative paths for distant files
import PWButton from '../../../components/button/PWButton'
```

Available aliases:
| Alias | Path |
|-------|------|
| `@/` | `src/` |
| `@components/` | `src/components/` |
| `@providers/` | `src/providers/` |
| `@routes/` | `src/routes/` |
| `@hooks/` | `src/hooks/` |
| `@constants/` | `src/constants/` |
| `@modules/` | `src/modules/` |
| `@layouts/` | `src/layouts/` |
| `@theme/` | `src/theme/` |
| `@assets/` | `assets/` |
| `@test-utils/` | `src/test-utils/` |

---

## Package Naming

Workspace packages follow `@perawallet/wallet-core-[domain]`:

```
@perawallet/wallet-core-accounts
@perawallet/wallet-core-assets
@perawallet/wallet-core-shared
@perawallet/wallet-core-platform-integration
@perawallet/wallet-core-devtools
```

---

## Examples

### ✅ Good Example: Complete Component

```typescript
// src/components/button/PWButton.tsx

import { useStyles } from './styles'

export type PWButtonProps = {
    variant: 'primary' | 'secondary'
    title: string
    isLoading?: boolean
    isDisabled?: boolean
    onPress?: () => void
}

const PWButton = ({
    variant,
    title,
    isLoading = false,
    isDisabled = false,
    onPress,
}: PWButtonProps) => {
    const styles = useStyles({ variant, isDisabled })

    const handlePress = () => {
        if (!isLoading && !isDisabled) {
            onPress?.()
        }
    }

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={handlePress}
            disabled={isDisabled}
        >
            {isLoading ? (
                <ActivityIndicator />
            ) : (
                <Text style={styles.title}>{title}</Text>
            )}
        </TouchableOpacity>
    )
}

export default PWButton
```

### ❌ Bad Example: Inconsistent Naming

```typescript
// Don't do this
export type buttonProps = {
    // Should be PascalCase
    Type: 'primary' | 'secondary' // Should be camelCase
    txt: string // Should be descriptive
    loading: boolean // Should be isLoading
    click?: () => void // Should be onPress
}

const button = (props: buttonProps) => {
    // Should be PWButton
    // ...
}
```
