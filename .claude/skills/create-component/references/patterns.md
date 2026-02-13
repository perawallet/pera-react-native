# Component Patterns Reference

## External Component Wrapper Examples

### Wrapping RNE Components

```typescript
// PWText/PWText.tsx
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

### Wrapping React Native Components

```typescript
// PWTouchableOpacity/PWTouchableOpacity.tsx
import { TouchableOpacity, TouchableOpacityProps } from 'react-native'

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

## Full Component Example (PWButton)

```typescript
// PWButton/PWButton.tsx
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

## Styles with Props Example

```typescript
// PWButton/styles.ts
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
            color:
                variant === 'primary'
                    ? theme.colors.buttonPrimaryText
                    : theme.colors.textMain,
        },
    }),
)
```

## Components That MUST Be Wrapped

| External Source | Examples |
|----------------|----------|
| `@rneui/themed` | `Text`, `Button`, `ListItem`, `Icon`, `Skeleton` |
| `react-native` | `TouchableOpacity`, `View`, `ScrollView` |
| Third-party | `BottomSheet`, `WebView`, modals, etc. |

## Theme Tokens

| Type | Usage | Examples |
|------|-------|----------|
| `theme.colors.*` | All colors | `background`, `textMain`, `textGray`, `linkPrimary`, `error` |
| `theme.spacing.*` | Margins, paddings, gaps | `xs`, `sm`, `md`, `lg`, `xl`, `xxl`, `3xl`, `4xl`, `5xl` |

## Barrel File Pattern

```typescript
// index.ts
export { PWButton } from './PWButton'
export type { PWButtonProps } from './PWButton'
```

## Subcomponent Rules

- Live in the same folder as the main component
- Extract into their own files
- NOT re-exported in `index.ts`
- Only used by the parent component
- If needed elsewhere, promote to its own component
