import { Text as RNEText } from '@rneui/themed'
import { useStyles } from './styles'
import { StyleProp, TextStyle, TextProps } from 'react-native'

export type PWTextProps = {
    children: React.ReactNode
    style?: StyleProp<TextStyle>
    variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'caption'
    numberOfLines?: number
    ellipsizeMode?: TextProps['ellipsizeMode']
    onPress?: () => void
}

export const PWText = ({
    children,
    style,
    variant = 'body',
    numberOfLines,
    ellipsizeMode,
    onPress,
}: PWTextProps) => {
    const styles = useStyles({ variant })

    return (
        <RNEText
            style={[styles.text, style]}
            h1={variant === 'h1'}
            h2={variant === 'h2'}
            h3={variant === 'h3'}
            h4={variant === 'h4'}
            numberOfLines={numberOfLines}
            ellipsizeMode={ellipsizeMode}
            onPress={onPress}
        >
            {children}
        </RNEText>
    )
}
