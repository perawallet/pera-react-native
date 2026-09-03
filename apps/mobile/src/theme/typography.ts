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

import type { Theme } from '@rneui/themed'
import type { TextStyle } from 'react-native'
import { fontFamilies } from '@constants/fonts'
import { moderateScale } from './scaling'

export type FontWeight = 400 | 500 | 600 | 700

export const getFontFamily = (weight: FontWeight) => {
    return fontFamilies.DMSANS[weight]
}

const getMonoFontFamily = (weight: 400 | 500) => {
    return fontFamilies.DMMONO[weight]
}

export type TypographyVariant =
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'body'
    | 'bodyLarge'
    | 'bodyCompact'
    | 'bodySemibold'
    | 'footnoteMedium'
    | 'caption'
    | 'captionMedium'
    | 'captionSmall'
    | 'link'
    | 'linkPositive'
    | 'mono'

export const getTypography = (
    theme: Theme,
    variant: TypographyVariant,
): TextStyle => {
    const typography: Record<TypographyVariant, TextStyle> = {
        h1: {
            fontFamily: getFontFamily(500),
            fontSize: moderateScale(32),
            lineHeight: moderateScale(40),
            color: theme.colors.textMain,
        },
        h2: {
            fontFamily: getFontFamily(500),
            fontSize: moderateScale(25),
            lineHeight: moderateScale(32),
            color: theme.colors.textMain,
        },
        h3: {
            fontFamily: getFontFamily(500),
            fontSize: moderateScale(19),
            lineHeight: moderateScale(24),
            color: theme.colors.textMain,
        },
        h4: {
            fontFamily: getFontFamily(600),
            fontSize: moderateScale(15),
            lineHeight: moderateScale(24),
            color: theme.colors.textMain,
        },
        body: {
            fontFamily: getFontFamily(400),
            fontSize: moderateScale(13),
            lineHeight: moderateScale(24),
            color: theme.colors.textMain,
        },
        bodyLarge: {
            fontFamily: getFontFamily(400),
            fontSize: moderateScale(15),
            lineHeight: moderateScale(24),
            color: theme.colors.textMain,
        },
        bodyCompact: {
            fontFamily: getFontFamily(400),
            fontSize: moderateScale(13),
            lineHeight: moderateScale(16),
            color: theme.colors.textMain,
        },
        bodySemibold: {
            fontFamily: getFontFamily(600),
            fontSize: moderateScale(13),
            lineHeight: moderateScale(24),
            color: theme.colors.textMain,
        },
        footnoteMedium: {
            fontFamily: getFontFamily(500),
            fontSize: moderateScale(13),
            lineHeight: moderateScale(20),
            color: theme.colors.textMain,
        },
        caption: {
            fontFamily: getFontFamily(400),
            fontSize: moderateScale(11),
            lineHeight: moderateScale(24),
            color: theme.colors.textMain,
        },
        captionMedium: {
            fontFamily: getFontFamily(500),
            fontSize: moderateScale(11),
            lineHeight: moderateScale(16),
            color: theme.colors.textMain,
        },
        captionSmall: {
            fontFamily: getFontFamily(500),
            fontSize: moderateScale(9),
            lineHeight: moderateScale(12),
            color: theme.colors.textMain,
        },
        link: {
            fontFamily: getFontFamily(500),
            fontSize: moderateScale(13),
            lineHeight: moderateScale(24),
            color: theme.colors.linkPrimary,
        },
        linkPositive: {
            fontFamily: getFontFamily(500),
            fontSize: moderateScale(13),
            lineHeight: moderateScale(24),
            color: theme.colors.positive,
        },
        mono: {
            fontFamily: getMonoFontFamily(400),
            fontSize: moderateScale(13),
            lineHeight: moderateScale(24),
            color: theme.colors.textMain,
        },
    }

    return typography[variant]
}

const variantFontWeights: Record<TypographyVariant, FontWeight> = {
    h1: 500,
    h2: 500,
    h3: 500,
    h4: 600,
    body: 400,
    bodyLarge: 400,
    bodyCompact: 400,
    bodySemibold: 600,
    footnoteMedium: 500,
    caption: 400,
    captionMedium: 500,
    captionSmall: 500,
    link: 500,
    linkPositive: 500,
    mono: 400,
}

export const getVariantFontWeight = (variant: TypographyVariant): FontWeight =>
    variantFontWeights[variant]

/**
 * Returns the given variant with its font weight (and matching family)
 * overridden. Preferred for one-off weight tweaks instead of adding a new
 * `*Medium` / `*Semibold` sibling to {@link TypographyVariant}: it keeps the
 * variant list lean and gives the caller a single knob.
 *
 * Example: `getFontWeightVariant(theme, 'bodyLarge', 600)` produces what
 * an `h4` is today (bodyLarge + 600). Colors / sizes / line-heights are
 * inherited from the base variant.
 */
export const getFontWeightVariant = (
    theme: Theme,
    variant: TypographyVariant,
    weight: FontWeight,
): TextStyle => ({
    ...getTypography(theme, variant),
    fontFamily: getFontFamily(weight),
})
