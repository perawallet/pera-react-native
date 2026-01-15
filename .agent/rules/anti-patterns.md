---
trigger: always_on
---

# Anti-Patterns to AVOID

## ❌ StyleSheet.create

```typescript
// ❌ BAD: Never use StyleSheet.create
import { StyleSheet } from 'react-native'
const styles = StyleSheet.create({
    container: { padding: 16 },
})

// ❌ BAD: Never use StyleSheet with useTheme
import { StyleSheet } from 'react-native'
import { useTheme } from '@rneui/themed'

export const useStyles = () => {
    const { theme } = useTheme()
    return StyleSheet.create({
        container: { backgroundColor: theme.colors.background },
    })
}

// ✅ GOOD: Always use makeStyles
import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    container: {
        padding: theme.spacing.md,
        backgroundColor: theme.colors.background,
    },
}))
```

## ❌ Inline Styles

```typescript
// ❌ BAD
<View style={{ padding: 16, backgroundColor: '#fff' }}>

// ✅ GOOD
<View style={styles.container}>
```

## ❌ Hardcoded Colors and Values

```typescript
// ❌ BAD: Hardcoded colors
container: { backgroundColor: '#FFFFFF' }
text: { color: '#000000' }

// ❌ BAD: Hardcoded spacing
container: { padding: 16, margin: 8 }

// ✅ GOOD: Use theme tokens
container: { backgroundColor: theme.colors.background }
text: { color: theme.colors.textMain }
container: { padding: theme.spacing.md, margin: theme.spacing.sm }
```

## ❌ Business Logic in UI

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

## ❌ Magic Numbers

```typescript
// ❌ BAD
if (retryCount > 3) {
}

// ✅ GOOD
const MAX_RETRIES = 3
if (retryCount > MAX_RETRIES) {
}
```

## ❌ Direct Store Access in UI

```typescript
// ❌ BAD: Direct store in component
import { useAccountsStore } from '@perawallet/wallet-core-accounts/store'

// ✅ GOOD: Use exposed hooks
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
```

## ❌ Complex Logic in Component Body

```typescript
// ❌ BAD: Logic written directly in component
const AccountCard = ({ account }: Props) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const { data } = useAccountBalanceQuery(account.address)

    const formattedBalance = useMemo(() => formatCurrency(data), [data])
    const handleToggle = useCallback(() => {
        setIsExpanded(prev => !prev)
        analytics.track('toggle')
    }, [])

    return (...)
}

// ✅ GOOD: Logic extracted to hook in same folder
// AccountCard/useAccountCard.ts
export const useAccountCard = (account: Account) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const { data, isLoading } = useAccountBalanceQuery(account.address)

    const formattedBalance = useMemo(() => formatCurrency(data), [data])
    const handleToggle = useCallback(() => {
        setIsExpanded(prev => !prev)
        analytics.track('toggle')
    }, [])

    return { isExpanded, isLoading, formattedBalance, handleToggle }
}

// AccountCard/AccountCard.tsx
const AccountCard = ({ account }: Props) => {
    const { isExpanded, formattedBalance, handleToggle } = useAccountCard(account)
    return (...)
}
```

## ❌ Wrong Hook Naming

```typescript
// ❌ BAD: Missing suffix for React Query hooks
const useAccountBalance = (address: string) => useQuery(...)
const useCreateAccount = () => useMutation(...)

// ❌ BAD: Wrong suffix for Zustand hooks
const useAccounts = () => useAccountsStore(state => state.accounts)

// ❌ BAD: PascalCase hook name
const UseAccountBalance = () => {}

// ✅ GOOD: Correct suffixes
const useAccountBalanceQuery = (address: string) => useQuery(...)
const useCreateAccountMutation = () => useMutation(...)
const useAccountsStore = () => useStore()
```

## ❌ Wrong Hook Location

```typescript
// ❌ BAD: Domain hook in screen folder
// modules/accounts/screens/AccountScreen/useAccountsQuery.ts

// ❌ BAD: Screen-specific hook in domain hooks folder
// modules/accounts/hooks/useAccountScreen.ts

// ✅ GOOD: Domain hooks in domain hooks folder
// modules/accounts/hooks/useAccountsQuery.ts

// ✅ GOOD: Screen-specific hook in screen folder
// modules/accounts/screens/AccountScreen/useAccountScreen.ts

// ✅ GOOD: Component-specific hook in component folder
// modules/accounts/components/AccountCard/useAccountCard.ts
```

## ❌ Exposing Dependency Types in Hooks

```typescript
// ❌ BAD: Returning React Query's UseQueryResult directly
import { UseQueryResult } from '@tanstack/react-query'

export const useAccountsQuery = (): UseQueryResult<Account[]> => {
    return useQuery({ ... })
}

// ❌ BAD: No explicit types, exposes all React Query internals
export const useAccountsQuery = () => {
    return useQuery({ ... })
}

// ❌ BAD: Returning Zustand store type directly
import { StoreApi } from 'zustand'

export const useAccountsStore = (): StoreApi<AccountsState> => {
    return useStore()
}

// ✅ GOOD: Define explicit, dependency-agnostic return type
type UseAccountsQueryResult = {
    accounts: Account[]
    isLoading: boolean
    isError: boolean
    error: Error | null
    refetch: () => void
}

export const useAccountsQuery = (): UseAccountsQueryResult => {
    const query = useQuery({ ... })

    return {
        accounts: query.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch,
    }
}
```

**Why this matters:**

- Decouples consumers from specific library implementations
- Enables swapping libraries (React Query → SWR, Zustand → Jotai) without breaking consumers
- Provides a stable, explicit API contract
- Improves IDE autocompletion with focused type definitions

## ❌ Deep Relative Imports

```typescript
// ❌ BAD
import PWButton from '../../../components/button/PWButton'

// ✅ GOOD
import PWButton from '@components/button/PWButton'
```

## ❌ Deep Import of Core Components

```typescript
// ❌ BAD: importing from specific component folder
import { PWButton } from '@components/core/PWButton'
import { PWText } from '@components/core/PWText/PWText'

// ✅ GOOD: import from core barrel file
import { PWButton, PWText } from '@components/core'
```

## ❌ Default Exports

```typescript
// ❌ BAD: Default exports
export default ComponentName

// import ComponentName from './ComponentName'

// ✅ GOOD: Named exports
export const ComponentName = () => {}

// import { ComponentName } from './ComponentName'
```

## ❌ Direct External Component Usage

```typescript
// ❌ BAD: Direct import from @rneui/themed in screens/modules
import { Text, Button, Icon } from '@rneui/themed'

const MyScreen = () => (
    <View>
        <Text>Hello</Text>
        <Button title="Submit" onPress={handleSubmit} />
        <Icon name="check" />
    </View>
)

// ❌ BAD: Direct import from react-native in screens/modules
import { TouchableOpacity, ScrollView } from 'react-native'

const MyComponent = () => (
    <TouchableOpacity onPress={handlePress}>
        <Text>Tap me</Text>
    </TouchableOpacity>
)

// ✅ GOOD: Use PW-wrapped components from the design system
import {
    PWText,
    PWButton,
    PWIcon,
    PWTouchableOpacity
} from '@components/core'

const MyScreen = () => (
    <PWView>
        <PWText variant="body">Hello</PWText>
        <PWButton variant="primary" title="Submit" onPress={handleSubmit} />
        <PWIcon name="check" variant="primary" />
    </PWView>
)
```

**Why this matters:**

- External component APIs can change between versions
- PW wrappers provide a stable, project-specific API
- Centralized customization (default styles, behaviors)
- Easier to migrate to different libraries in the future
