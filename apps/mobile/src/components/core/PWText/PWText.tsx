/*
 Copyright 2022-2026 Pera Wallet, LDA
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
import {
    type StyleProp,
    type TextStyle,
    type TextProps,
    StyleSheet,
    useWindowDimensions,
} from 'react-native'
import { type FontWeight, type TypographyVariant } from '@theme/typography'
import {
    DEFAULT_MINIMUM_FONT_SCALE,
    MAX_FONT_SIZE_MULTIPLIER,
} from '../constants'
import { scaleLineHeight } from '@theme/scaling'
import { getTestProps } from '@utils/test-id-helper'
import { useOverflowProbe } from '@modules/locale-tour/hooks/useOverflowProbe'

export type PWTextProps = {
    children?: React.ReactNode
    style?: StyleProp<TextStyle>
    variant?: TypographyVariant
    weight?: FontWeight
    numberOfLines?: number
    ellipsizeMode?: TextProps['ellipsizeMode']
    truncate?: boolean
    adjustsFontSizeToFit?: TextProps['adjustsFontSizeToFit']
    minimumFontScale?: TextProps['minimumFontScale']
    selectable?: TextProps['selectable']
    accessibilityLabel?: TextProps['accessibilityLabel']
    testID?: string
    onPress?: () => void
}

export const PWText = ({
    children,
    style,
    variant = 'body',
    weight,
    numberOfLines,
    ellipsizeMode,
    truncate,
    adjustsFontSizeToFit,
    minimumFontScale,
    selectable,
    onPress,
    testID,
    ...props
}: PWTextProps) => {
    const styles = useStyles({ variant, weight })
    const { fontScale = 1 } = useWindowDimensions()

    const baseStyle = [styles.text, truncate && styles.truncate, style]
    const { lineHeight, fontSize } = StyleSheet.flatten<TextStyle>(baseStyle)
    const scaledLineHeight = scaleLineHeight(
        lineHeight,
        fontSize,
        fontScale,
        MAX_FONT_SIZE_MULTIPLIER,
    )

    const resolvedMinimumFontScale =
        minimumFontScale ??
        (adjustsFontSizeToFit ? DEFAULT_MINIMUM_FONT_SCALE : undefined)
    const resolvedNumberOfLines = numberOfLines ?? (truncate ? 1 : undefined)

    const overflowProbe = useOverflowProbe({
        children,
        testID,
        numberOfLines: resolvedNumberOfLines,
    })

    return (
        <RNEText
            style={[
                baseStyle,
                scaledLineHeight !== undefined && {
                    lineHeight: scaledLineHeight,
                },
            ]}
            numberOfLines={resolvedNumberOfLines}
            ellipsizeMode={ellipsizeMode ?? (truncate ? 'tail' : undefined)}
            adjustsFontSizeToFit={adjustsFontSizeToFit}
            minimumFontScale={resolvedMinimumFontScale}
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            selectable={selectable}
            onPress={onPress}
            onLayout={overflowProbe.onLayout}
            onTextLayout={overflowProbe.onTextLayout}
            {...getTestProps(testID)}
            {...props}
        >
            {children}
        </RNEText>
    )
}
