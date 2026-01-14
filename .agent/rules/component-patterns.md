---
trigger: always_on
---

# Component Patterns

## Component Folder Structure

Every component MUST follow this folder structure:

```
ComponentName/              # PascalCase folder name
├── ComponentName.tsx       # Component file (same name as folder)
├── styles.ts               # Styles file at same level
├── index.ts                # Barrel file re-exporting the component
├── __tests__/              # Tests folder
│   └── ComponentName.spec.tsx  # Test file (same name + .spec.tsx)
└── SubComponent.tsx        # Subcomponents live here (NOT re-exported)
```

### Barrel File Pattern

```typescript
// index.ts
export { default } from './PWButton'
export type { PWButtonProps } from './PWButton'
```

### Subcomponent Rules

- Subcomponents live in the same folder as the main component
- Subcomponents are **NOT** re-exported in the barrel file
- Subcomponents should only be used by the parent component
- If a subcomponent is needed elsewhere, it should become its own component

## Shared UI Components (PW-prefixed)

Location: `apps/mobile/src/components/[ComponentName]/`

```typescript
// PWButton.tsx
import { Text } from '@rneui/themed'
import { ActivityIndicator } from 'react-native'
import PWTouchableOpacity from '@components/PWTouchableOpacity'
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

## Style Files (REQUIRED: makeStyles)

All styling MUST use `makeStyles` from `@rneui/themed`. **Never use `StyleSheet.create`**.

### Basic Usage

```typescript
// styles.ts
import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        padding: theme.spacing.md,
    },
    title: {
        color: theme.colors.textMain,
        fontSize: 16,
    },
}))
```

### With Props

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
    }),
)
```

### Theme Tokens

| Type              | Usage                   | Examples                                                     |
| ----------------- | ----------------------- | ------------------------------------------------------------ |
| `theme.colors.*`  | All colors              | `background`, `textMain`, `textGray`, `linkPrimary`, `error` |
| `theme.spacing.*` | Margins, paddings, gaps | `xs`, `sm`, `md`, `lg`, `xl`, `xxl`, `3xl`, `4xl`, `5xl`     |

## Module-Specific Components

Location: `apps/mobile/src/modules/[module]/components/[ComponentName]/`

NO `PW` prefix for module components:

```typescript
// AccountCard.tsx (in modules/accounts/components/)
const AccountCard = ({ account, onPress }: AccountCardProps) => {
    // ...
}
```

## Screen Components

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
