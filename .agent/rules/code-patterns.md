---
trigger: always_on
---

# Code Patterns & Standards

This document contains detailed code patterns that MUST be followed when generating code.

---

## Component Patterns

### Shared UI Components (PW-prefixed)

Location: `apps/mobile/src/components/[component-name]/`

```typescript
// PWButton.tsx
import { Text } from '@rneui/themed'
import { ActivityIndicator } from 'react-native'
import PWTouchableOpacity from '@components/touchable-opacity/PWTouchableOpacity'
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
        <PWTouchableOpacity
            style={styles.container}
            onPress={handlePress}
            disabled={isDisabled}
        >
            {isLoading ? (
                <ActivityIndicator size="small" color={styles.loader.color} />
            ) : (
                <Text style={styles.title}>{title}</Text>
            )}
        </PWTouchableOpacity>
    )
}

export default PWButton
```

### Style Files

```typescript
// styles.ts
import { makeStyles } from '@rneui/themed'

type StyleProps = {
    variant: 'primary' | 'secondary'
    isDisabled: boolean
}

export const useStyles = makeStyles(
    (theme, { variant, isDisabled }: StyleProps) => ({
        container: {
            backgroundColor:
                variant === 'primary'
                    ? theme.colors.buttonPrimaryBg
                    : theme.colors.layerGrayLighter,
            padding: theme.spacing.md,
            borderRadius: theme.spacing.xs,
            opacity: isDisabled ? 0.5 : 1,
        },
        title: {
            color:
                variant === 'primary'
                    ? theme.colors.buttonPrimaryText
                    : theme.colors.textMain,
            fontSize: 16,
        },
        loader: {
            color: theme.colors.buttonPrimaryText,
        },
    }),
)
```

### Module-Specific Components

Location: `apps/mobile/src/modules/[module]/components/[component-name]/`

NO `PW` prefix for module components:

```typescript
// AccountCard.tsx (in modules/accounts/components/)
const AccountCard = ({ account, onPress }: AccountCardProps) => {
    // ...
}
```

### Screen Components

Location: `apps/mobile/src/modules/[module]/screens/`

```typescript
// AccountsScreen.tsx
import { useStyles } from './AccountsScreen.styles'

const AccountsScreen = () => {
    const styles = useStyles()
    const { accounts } = useAllAccounts()

    return (
        <View style={styles.container}>
            {/* ... */}
        </View>
    )
}

export default AccountsScreen
```

---

## Hook Patterns

### Business Logic Hooks (in packages/)

Location: `packages/[domain]/src/hooks/`

```typescript
// useAccountBalancesQuery.ts
import { useQuery } from '@tanstack/react-query'
import { fetchAccountBalances } from './endpoints'
import { accountQueryKeys } from './querykeys'

export const useAccountBalancesQuery = (address: string) => {
    return useQuery({
        queryKey: accountQueryKeys.balances(address),
        queryFn: () => fetchAccountBalances(address),
        enabled: !!address,
    })
}
```

### Store Hooks

```typescript
// useAllAccounts.ts
import { useAccountsStore } from '../store'

export const useAllAccounts = () => {
    return useAccountsStore(state => state.accounts)
}
```

### UI Hooks (in apps/mobile/)

Location: `apps/mobile/src/hooks/`

```typescript
// toast.ts
import { useCallback } from 'react'
import { useToastStore } from '@providers/ToastProvider'

type ToastParams = {
    title: string
    body: string
    type: 'info' | 'success' | 'error'
}

const useToast = () => {
    const { showToast: show } = useToastStore()

    const showToast = useCallback(
        (params: ToastParams) => {
            show(params)
        },
        [show],
    )

    return { showToast }
}

export default useToast
```

---

## Zustand Store Patterns

Location: `packages/[domain]/src/store/store.ts`

```typescript
import { createStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { KeyValueStorageService } from '@perawallet/wallet-core-platform-integration'
import { createLazyStore } from '@perawallet/wallet-core-shared'

export type AccountsState = {
    accounts: WalletAccount[]
    selectedAccountAddress: string | null
}

export type AccountsActions = {
    setAccounts: (accounts: WalletAccount[]) => void
    setSelectedAccountAddress: (address: string | null) => void
}

export type AccountsStore = AccountsState & AccountsActions

const initialState: AccountsState = {
    accounts: [],
    selectedAccountAddress: null,
}

export const createAccountsStore = (storage: KeyValueStorageService) =>
    createStore<AccountsStore>()(
        persist(
            set => ({
                ...initialState,
                setAccounts: accounts => set({ accounts }),
                setSelectedAccountAddress: address =>
                    set({ selectedAccountAddress: address }),
            }),
            {
                name: 'accounts-storage',
                storage: createJSONStorage(() => ({
                    getItem: key => storage.getItem(key),
                    setItem: (key, value) => storage.setItem(key, value),
                    removeItem: key => storage.removeItem(key),
                })),
            },
        ),
    )

// Lazy initialization
export const { useStore: useAccountsStore, initStore: initAccountsStore } =
    createLazyStore<AccountsStore, [KeyValueStorageService]>(
        createAccountsStore,
    )
```

### Store Access Pattern

```typescript
// ✅ GOOD: Granular selectors
const accounts = useAccountsStore(state => state.accounts)
const selectedAddress = useAccountsStore(state => state.selectedAccountAddress)

// ✅ GOOD: Multiple values with shallow comparison
import { shallow } from 'zustand/shallow'
const { accounts, selectedAccountAddress } = useAccountsStore(
    state => ({
        accounts: state.accounts,
        selectedAccountAddress: state.selectedAccountAddress,
    }),
    shallow,
)

// ❌ BAD: Subscribes to entire store
const store = useAccountsStore()
const { accounts } = useAccountsStore()
```

---

## TypeScript Patterns

### Type Definitions

```typescript
// Use type for unions and simple shapes
type AccountType = 'standard' | 'multisig' | 'ledger'
type LoadingState = 'idle' | 'loading' | 'success' | 'error'

// Use interface when extension is expected
interface WalletAccount {
    id: string
    address: string
    name: string
    type: AccountType
}

// Props should use type
type AccountCardProps = {
    account: WalletAccount
    isSelected?: boolean
    onPress?: () => void
}
```

### Avoid `any`

```typescript
// ❌ BAD
const data: any = fetchData()

// ✅ GOOD
const data: unknown = fetchData()
if (isValidData(data)) {
    // data is now typed
}

// ✅ BETTER: Define the type
interface ApiResponse {
    accounts: WalletAccount[]
}
const data: ApiResponse = await fetchData()
```

### Boolean Props

```typescript
// ✅ GOOD: Clear boolean naming
type Props = {
    isLoading: boolean
    isDisabled: boolean
    hasError: boolean
    canSubmit: boolean
    shouldAutoFocus: boolean
}

// ❌ BAD: Ambiguous
type Props = {
    loading: boolean
    disabled: boolean
    error: boolean
}
```

### Event Handlers

```typescript
// Props use "on" prefix
type Props = {
    onPress: () => void
    onSubmit: (data: FormData) => void
    onChange: (value: string) => void
}

// Internal handlers use "handle" prefix
const MyComponent = ({ onSubmit }: Props) => {
    const handleSubmit = () => {
        // Process and validate
        onSubmit(data)
    }
}
```

---

## Import Order

Always follow this order:

```typescript
// 1. React/React Native
import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet } from 'react-native'

// 2. Third-party libraries
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '@rneui/themed'

// 3. Internal packages (@perawallet/*)
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { logger } from '@perawallet/wallet-core-shared'

// 4. App aliases (@components, @hooks, etc.)
import PWButton from '@components/button/PWButton'
import { useToast } from '@hooks/toast'

// 5. Relative imports
import { useStyles } from './styles'
import type { MyComponentProps } from './types'
```

---

## Testing Patterns

### Package Tests (Vitest)

```typescript
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

describe('useAllAccounts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('returns all accounts from store', () => {
        const { result } = renderHook(() => useAllAccounts())
        expect(result.current).toEqual([])
    })
})
```

### Mobile App Tests (Jest)

```typescript
import { render, fireEvent } from '@test-utils'

describe('PWButton', () => {
    test('calls onPress when pressed', () => {
        const onPress = jest.fn()
        const { getByText } = render(
            <PWButton variant="primary" title="Click me" onPress={onPress} />
        )

        fireEvent.press(getByText('Click me'))
        expect(onPress).toHaveBeenCalledTimes(1)
    })
})
```

---

## Anti-Patterns to AVOID

### ❌ Business Logic in UI

```typescript
// ❌ BAD: Logic in component
const AccountScreen = () => {
    const [accounts, setAccounts] = useState([])

    useEffect(() => {
        fetch('/api/accounts')
            .then(res => res.json())
            .then(setAccounts)
    }, [])
}

// ✅ GOOD: Logic in package hook
const AccountScreen = () => {
    const { accounts, isLoading } = useAccountsQuery()
}
```

### ❌ Inline Styles

```typescript
// ❌ BAD
<View style={{ padding: 16, backgroundColor: '#fff' }}>

// ✅ GOOD
<View style={styles.container}>
```

### ❌ Magic Numbers

```typescript
// ❌ BAD
if (retryCount > 3) {
}

// ✅ GOOD
const MAX_RETRIES = 3
if (retryCount > MAX_RETRIES) {
}
```

### ❌ Direct Store Access in UI

```typescript
// ❌ BAD: Direct store in component
import { useAccountsStore } from '@perawallet/wallet-core-accounts/store'

// ✅ GOOD: Use exposed hooks
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
```

### ❌ Deep Relative Imports

```typescript
// ❌ BAD
import PWButton from '../../../components/button/PWButton'

// ✅ GOOD
import PWButton from '@components/button/PWButton'
```

## Component Testing (Vitest + RNTL)

All UI components MUST have behavior tests using Vitest and React Native Testing Library.

### File Naming

- Use `.spec.tsx` extension
- Colocate with component in `__tests__` directory

### Testing Principles

1. **Behavior Only**: Do not test static styles or text rendering unless conditional.
2. **AAA Pattern**: Arrange, Act, Assert.
3. **Atomic**: Keep tests focused on a single behavior.
4. **Naming**: `it('does something when event happens')`

### Template

```typescript
import { render, fireEvent, screen } from '@testing-library/react-native'
import { describe, it, expect, vi } from 'vitest'
import PWButton from '../PWButton'

describe('PWButton', () => {
    it('calls onPress when pressed', () => {
        // Arrange
        const onPress = vi.fn()
        render(<PWButton title="Submit" onPress={onPress} variant="primary" />)

        // Act
        fireEvent.press(screen.getByText('Submit'))

        // Assert
        expect(onPress).toHaveBeenCalledTimes(1)
    })

    it('shows loader and disables press when isLoading is true', () => {
        // Arrange
        const onPress = vi.fn()
        render(
            <PWButton
                title="Submit"
                onPress={onPress}
                variant="primary"
                isLoading={true}
            />
        )

        // Act
        fireEvent.press(screen.getByRole('button')) // or appropriate query

        // Assert
        expect(screen.getByTestId('activity-indicator')).toBeTruthy()
        expect(onPress).not.toHaveBeenCalled()
    })
})
```
