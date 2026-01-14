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

## ❌ Deep Relative Imports

```typescript
// ❌ BAD
import PWButton from '../../../components/button/PWButton'

// ✅ GOOD
import PWButton from '@components/button/PWButton'
```
