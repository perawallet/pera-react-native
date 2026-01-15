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

export type PWTextProps = {
    children?: React.ReactNode
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
