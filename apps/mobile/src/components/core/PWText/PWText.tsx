/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { Text as RNEText } from '@rneui/themed'
import { useStyles } from './styles'
import { StyleProp, TextStyle, TextProps } from 'react-native'

/**
 * Props for the PWText component.
 */
export type PWTextProps = {
    /** Content of the text component */
    children?: React.ReactNode
    /** Optional style overrides for the text */
    style?: StyleProp<TextStyle>
    /** Text style variant defining size and weight */
    variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'caption'
    /** Maximum number of lines for the text */
    numberOfLines?: number
    /** How text overflows when numberOfLines is set */
    ellipsizeMode?: TextProps['ellipsizeMode']
    /** Callback when text is pressed */
    onPress?: () => void
}

/**
 * A themed text component wrapping RNE Text with predefined variants.
 *
 * @example
 * <PWText variant="h1">Header Text</PWText>
 */
export const PWText = ({
    children,
    style,
    variant = 'body',
    numberOfLines,
    ellipsizeMode,
    onPress,
    ...props
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
            {...props}
        >
            {children}
        </RNEText>
    )
}
