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
import { type FontWeight, type TypographyVariant } from '@theme/typography'
import { DEFAULT_MINIMUM_FONT_SCALE } from '../constants'
import { getTestProps } from '@utils/test-id-helper'

export type PWTextProps = {
    children?: React.ReactNode
    style?: StyleProp<TextStyle>
    variant?: TypographyVariant
    /**
     * Overrides the variant's font weight (and matching family). Use this
     * instead of adding a dedicated `*Medium` / `*Semibold` sibling variant
     * for one-off weight tweaks.
     */
    weight?: FontWeight
    numberOfLines?: number
    ellipsizeMode?: TextProps['ellipsizeMode']
    /**
     * Single-line tail truncation that also shrinks within row layouts.
     * Sets `numberOfLines=1` and `ellipsizeMode='tail'` (both still
     * overridable) plus `flexShrink: 1` / `minWidth: 0`.
     */
    truncate?: boolean
    adjustsFontSizeToFit?: TextProps['adjustsFontSizeToFit']
    minimumFontScale?: TextProps['minimumFontScale']
    selectable?: TextProps['selectable']
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

    const resolvedMinimumFontScale =
        minimumFontScale ??
        (adjustsFontSizeToFit ? DEFAULT_MINIMUM_FONT_SCALE : undefined)

    return (
        <RNEText
            style={[styles.text, truncate && styles.truncate, style]}
            numberOfLines={numberOfLines ?? (truncate ? 1 : undefined)}
            ellipsizeMode={ellipsizeMode ?? (truncate ? 'tail' : undefined)}
            adjustsFontSizeToFit={adjustsFontSizeToFit}
            minimumFontScale={resolvedMinimumFontScale}
            selectable={selectable}
            onPress={onPress}
            {...getTestProps(testID)}
            {...props}
        >
            {children}
        </RNEText>
    )
}
