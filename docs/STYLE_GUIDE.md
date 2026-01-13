# Style Guide & Coding Standards

We follow strict standards to keep the codebase clean, consistent, and maintainable.

## Git Workflow

### Branch Naming

Use the format `<user-name>/<feature-or-fix>`:

```
# ✅ GOOD
john/add-login-screen
sarah/fix-balance-display
team/refactor-accounts-module

# ❌ BAD
feature-login          # Missing username
john_add_login         # Underscores instead of slashes
```

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
# Format
<type>(<scope>): <description>

# Types
feat:     New feature
fix:      Bug fix
docs:     Documentation only
style:    Formatting (no code change)
refactor: Code restructuring
test:     Adding tests
chore:    Maintenance tasks
```

Examples:

```
feat(accounts): add account import from mnemonic
fix(settings): correct currency format display
docs: update testing guide
refactor(hooks): simplify useAccountBalance
test(accounts): add tests for account creation
chore: update dependencies
```

### Pull Requests

- Target the `main` branch
- Ensure all tests pass
- Use **Squash Merge** when merging
- Fill out the PR template

---

## TypeScript

### Strict Mode

TypeScript strict mode is **enabled**. Do not disable it:

```typescript
// tsconfig.json
{
    "compilerOptions": {
        "strict": true
    }
}
```

### Avoid `any`

Avoid `any` whenever possible. Use `unknown` with type guards or define proper interfaces:

```typescript
// ❌ BAD
const data: any = fetchData()
data.someProperty

// ✅ GOOD
const data: unknown = fetchData()
if (isValidData(data)) {
    data.someProperty
}

// ✅ BETTER
interface ApiResponse {
    someProperty: string
}
const data: ApiResponse = await fetchData()
```

### Explicit Return Types

Define return types for functions, especially exported ones:

```typescript
// ❌ BAD
export const formatBalance = amount => {
    return amount / 1000000
}

// ✅ GOOD
export const formatBalance = (amount: number): string => {
    return (amount / 1000000).toFixed(6)
}
```

### Type vs Interface

Prefer `type` for most cases; use `interface` when extending is expected:

```typescript
// Simple types
type AccountId = string
type AccountType = 'standard' | 'multisig' | 'ledger'

// Object shapes (when extension is expected)
interface WalletAccount {
    id: string
    address: string
    name: string
}

// Union types (must use type)
type LoadingState = 'idle' | 'loading' | 'success' | 'error'
```

---

## React & Components

### Functional Components Only

Use functional components with Hooks. Class components are legacy:

```typescript
// ❌ BAD
class AccountCard extends React.Component {}

// ✅ GOOD
const AccountCard = (props: AccountCardProps) => {}
```

### Component Structure

Follow this order within components:

```typescript
const MyComponent = (props: MyComponentProps) => {
    // 1. Hooks (useState, useEffect, custom hooks)
    const [isLoading, setIsLoading] = useState(false)
    const { t } = useLanguage()
    const styles = useStyles()

    // 2. Derived state
    const isDisabled = isLoading || props.disabled

    // 3. Event handlers
    const handlePress = () => {
        // ...
    }

    // 4. Return
    return (
        <View style={styles.container}>
            {/* ... */}
        </View>
    )
}

export default MyComponent
```

### Props Destructuring

Destructure props in the function signature:

```typescript
// ❌ BAD
const MyComponent = (props) => {
    return <Text>{props.title}</Text>
}

// ✅ GOOD
const MyComponent = ({ title, onPress }: MyComponentProps) => {
    return <Text>{title}</Text>
}
```

### Custom Hooks

Encapsulate logic in `use[Feature]` hooks:

```typescript
// ❌ BAD: Logic in component
const MyScreen = () => {
    const [accounts, setAccounts] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        fetchAccounts().then(data => {
            setAccounts(data)
            setIsLoading(false)
        })
    }, [])

    // ...
}

// ✅ GOOD: Logic in hook
const MyScreen = () => {
    const { accounts, isLoading } = useAccounts()
    // ...
}
```

---

## Styling

### StyleSheet.create

Use `StyleSheet.create` for all styles:

```typescript
// ❌ BAD: Inline styles
<View style={{ padding: 16, backgroundColor: '#fff' }}>

// ✅ GOOD: StyleSheet
const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: '#fff',
    },
})

<View style={styles.container}>
```

### Theme-Based Styling

Use the theme for colors and spacing:

```typescript
// styles.ts
import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    container: {
        backgroundColor: theme.colors.background,
        padding: theme.spacing.md,
    },
    title: {
        color: theme.colors.textMain,
        fontSize: 16,
    },
}))
```

### Style File Organization

```
component/
├── MyComponent.tsx
└── styles.ts           # All styles in separate file

# OR for screens
screens/
├── MyScreen.tsx
└── MyScreen.styles.ts
```

---

## Naming Conventions Summary

| Element             | Convention                 | Example                       |
| ------------------- | -------------------------- | ----------------------------- |
| Variables/Functions | `camelCase`                | `fetchBalance`, `isValid`     |
| Components/Classes  | `PascalCase`               | `AccountCard`, `WalletStore`  |
| Constants           | `UPPER_SNAKE_CASE`         | `MAX_RETRIES`, `API_URL`      |
| Boolean Props       | `is/has/should/can` prefix | `isLoading`, `hasError`       |
| Event Props         | `on` prefix                | `onPress`, `onSubmit`         |
| Event Handlers      | `handle` prefix            | `handlePress`, `handleSubmit` |
| UI Components       | `PW` prefix                | `PWButton`, `PWCard`          |

---

## Imports

### Order

Group imports in this order:

```typescript
// 1. React/React Native
import React, { useState, useEffect } from 'react'
import { View, Text } from 'react-native'

// 2. Third-party libraries
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '@rneui/themed'

// 3. Internal packages (@perawallet/*)
import { useAllAccounts } from '@perawallet/wallet-core-accounts'

// 4. Internal app imports (aliases)
import PWButton from '@components/button/PWButton'
import { useToast } from '@hooks/toast'

// 5. Relative imports
import { useStyles } from './styles'
import type { MyComponentProps } from './types'
```

### Path Aliases

Use path aliases instead of deep relative imports:

```typescript
// ❌ BAD
import PWButton from '../../../components/button/PWButton'

// ✅ GOOD
import PWButton from '@components/button/PWButton'
```

---

## Project Rules

### No Magic Numbers/Strings

Extract recurring values to constants:

```typescript
// ❌ BAD
if (retryCount > 3) {
}
const apiUrl = 'https://api.example.com'

// ✅ GOOD
const MAX_RETRIES = 3
if (retryCount > MAX_RETRIES) {
}

// In constants file
export const API_URL = 'https://api.example.com'
```

### Comments

Comment _why_, not _what_. Code should be self-documenting:

```typescript
// ❌ BAD: States the obvious
// Increment counter by 1
counter += 1

// ✅ GOOD: Explains why
// Offset by 1 to match 1-indexed API response
counter += 1
```

### Error Handling

Always handle errors explicitly:

```typescript
// ❌ BAD
try {
    await fetchData()
} catch (e) {
    // Empty catch
}

// ✅ GOOD
try {
    await fetchData()
} catch (error) {
    logger.error('Failed to fetch data', { error })
    throw new DataFetchError('Unable to load data')
}
```

---

## Linting & Formatting

### Prettier

Prettier runs automatically on pre-commit. Manual run:

```sh
pnpm format
```

### ESLint

ESLint checks code quality:

```sh
pnpm lint        # Check for issues
pnpm lint:fix    # Auto-fix issues
```

### Pre-commit Hooks

Git hooks are installed via `pnpm run setup`:

- **commit-msg**: Validates conventional commit format
- **pre-push**: Runs lint, format, copyright, and tests

---

## Code Examples

### ✅ Good: Complete Component

```typescript
/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0
 */

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

### ❌ Bad: Multiple Issues

```typescript
// Missing copyright header

import React from 'react'

// Props not typed properly
export default function button(props: any) {
    // Inline styles
    return (
        <View style={{ padding: 10 }}>
            {/* Magic string */}
            <Text style={{ color: '#000' }}>
                {props.txt}
            </Text>
        </View>
    )
}
```
