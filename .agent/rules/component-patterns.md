---
trigger: always_on
---

# Component Patterns

## Component Folder Structure

Every component MUST follow this folder structure:

```
ComponentName/              # PascalCase folder name (REQUIRED for components)
├── ComponentName.tsx       # Component file (same name as folder)
├── styles.ts               # Styles file at same level
├── index.ts                # Barrel file re-exporting the component
├── __tests__/              # Tests folder
│   └── ComponentName.spec.tsx  # Test file (same name + .spec.tsx)
└── SubComponent.tsx        # Subcomponents live here (NOT re-exported)
```

### Folder Naming Rules

| Folder Type      | Case         | Example                                        |
| ---------------- | ------------ | ---------------------------------------------- |
| Component folder | `PascalCase` | `PWButton/`, `AccountCard/`, `SettingsScreen/` |
| Grouping folder  | `kebab-case` | `signing/`, `market/`, `holdings/`             |
| Utility folder   | `kebab-case` | `hooks/`, `utils/`, `providers/`               |

**Grouping folders** organize multiple component folders but are NOT components themselves:

```
modules/transactions/components/
├── signing/                    # Grouping folder (kebab-case)
│   ├── BalanceImpactView/      # Component folder (PascalCase)
│   └── TransactionSigningView/ # Component folder (PascalCase)
└── TransactionIcon/            # Component folder (PascalCase)
```

### Barrel File Pattern

// index.ts
export { PWButton } from './PWButton'
export type { PWButtonProps } from './PWButton'

````

### Core Barrel File Pattern

All core components in `apps/mobile/src/components/core/` are re-exported from a central barrel file.

**ALWAYS** import core components from `@components/core`:

```typescript
// ✅ GOOD
import { PWButton, PWText } from '@components/core'

// ❌ BAD
import { PWButton } from '@components/core/PWButton'
import { PWText } from '@components/core/PWText/PWText'
````

### Subcomponent Rules

- Subcomponents live in the same folder as the main component
- Subcomponents are **NOT** re-exported in the barrel file
- Subcomponents should only be used by the parent component
- If a subcomponent is needed elsewhere, it should become its own component

## External Component Wrapper Pattern (REQUIRED)

All components from external dependencies (RNE, React Native, third-party libraries) **MUST** be wrapped in local `PW`-prefixed components before use in the codebase.

### Why Wrap External Components?

1. **Consistent API**: Define a clean, project-specific props interface
2. **Abstraction**: Shield the codebase from external API changes
3. **Centralized customization**: Apply default styles and behaviors in one place
4. **Easy migration**: Swap underlying implementations without touching consumers
5. **Type safety**: Expose only the props your codebase needs

### Wrapper Component Location (Design System)

`PW*` components form the app's **design system** and live in:

```
apps/mobile/src/components/core/PW[ComponentName]/
```

This location distinguishes design system primitives from feature-specific shared components.

### Example: Wrapping RNE Components

```typescript
// PWText/PWText.tsx - Wrapping @rneui/themed Text
import { Text as RNEText, TextProps as RNETextProps } from '@rneui/themed'
import { useStyles } from './styles'

export type PWTextProps = {
    variant?: 'body' | 'heading' | 'caption'
    children: React.ReactNode
    style?: RNETextProps['style']
}

export const PWText = ({ variant = 'body', children, style }: PWTextProps) => {
    const styles = useStyles({ variant })

    return <RNEText style={[styles.text, style]}>{children}</RNEText>
}
```

### Example: Wrapping React Native Components

```typescript
// PWTouchableOpacity/PWTouchableOpacity.tsx
import {
    TouchableOpacity,
    TouchableOpacityProps,
} from 'react-native'

export type PWTouchableOpacityProps = {
    children: React.ReactNode
    onPress?: () => void
    isDisabled?: boolean
    style?: TouchableOpacityProps['style']
    activeOpacity?: number
}

export const PWTouchableOpacity = ({
    children,
    onPress,
    isDisabled = false,
    style,
    activeOpacity = 0.7,
}: PWTouchableOpacityProps) => {
    return (
        <TouchableOpacity
            style={style}
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={activeOpacity}
        >
            {children}
        </TouchableOpacity>
    )
}
```

### Components That MUST Be Wrapped

| External Source | Examples                                         |
| --------------- | ------------------------------------------------ |
| `@rneui/themed` | `Text`, `Button`, `ListItem`, `Icon`, `Skeleton` |
| `react-native`  | `TouchableOpacity`, `View`, `ScrollView`         |
| Third-party     | `BottomSheet`, `WebView`, modals, etc.           |

### Exceptions (No Wrapper Needed)

- `ActivityIndicator` - Simple, stable API
- Basic layout primitives used only internally within PW components

## Shared UI Components (PW-prefixed)

Location: `apps/mobile/src/components/core/[ComponentName]/`

These are the **design system primitives** that wrap external dependencies and provide a consistent API across the app.

```typescript
// PWButton.tsx
import { Text } from '@rneui/themed'
import { ActivityIndicator } from 'react-native'
import { PWTouchableOpacity } from '@components/core'
import { useStyles } from './styles'

export type PWButtonProps = {
    variant: 'primary' | 'secondary'
    title: string
    isLoading?: boolean
    isDisabled?: boolean
    onPress?: () => void
}

export const PWButton = ({
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

Location: `apps/mobile/src/modules/[module]/screens/[ScreenName]/`

Every screen MUST follow the same folder structure as standard components.

```typescript
// AccountsScreen.tsx (in modules/accounts/screens/AccountsScreen/)
import { useStyles } from './styles'

export const AccountsScreen = () => {
    const styles = useStyles()
    const { accounts } = useAllAccounts()

    return (
        <View style={styles.container}>
            {/* ... */}
        </View>
    )
}
```
