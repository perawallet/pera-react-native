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

import { Theme } from '@rneui/themed'
import { TextStyle } from 'react-native'
import { fontFamilies } from '@constants/fonts'

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
            fontSize: 32,
            lineHeight: 40,
            color: theme.colors.textMain,
            fontWeight: 500,
        },
        h2: {
            fontFamily: getFontFamily(500),
            fontSize: 25,
            lineHeight: 32,
            color: theme.colors.textMain,
            fontWeight: 500,
        },
        h3: {
            fontFamily: getFontFamily(500),
            fontSize: 19,
            lineHeight: 24,
            color: theme.colors.textMain,
            fontWeight: 500,
        },
        h4: {
            fontFamily: getFontFamily(600),
            fontSize: 15,
            lineHeight: 24,
            color: theme.colors.textMain,
            fontWeight: 600,
        },
        body: {
            fontFamily: getFontFamily(400),
            fontSize: 13,
            lineHeight: 24,
            color: theme.colors.textMain,
            fontWeight: 400,
        },
        bodyLarge: {
            fontFamily: getFontFamily(400),
            fontSize: 15,
            lineHeight: 24,
            color: theme.colors.textMain,
            fontWeight: 400,
        },
        bodyCompact: {
            fontFamily: getFontFamily(400),
            fontSize: 13,
            lineHeight: 16,
            color: theme.colors.textMain,
            fontWeight: 400,
        },
        bodySemibold: {
            fontFamily: getFontFamily(600),
            fontSize: 13,
            lineHeight: 24,
            color: theme.colors.textMain,
            fontWeight: 600,
        },
        footnoteMedium: {
            fontFamily: getFontFamily(500),
            fontSize: 13,
            lineHeight: 20,
            color: theme.colors.textMain,
            fontWeight: 500,
        },
        caption: {
            fontFamily: getFontFamily(400),
            fontSize: 11,
            lineHeight: 24,
            color: theme.colors.textMain,
            fontWeight: 400,
        },
        captionMedium: {
            fontFamily: getFontFamily(500),
            fontSize: 11,
            lineHeight: 16,
            color: theme.colors.textMain,
            fontWeight: 500,
        },
        captionSmall: {
            fontFamily: getFontFamily(500),
            fontSize: 9,
            lineHeight: 12,
            color: theme.colors.textMain,
            fontWeight: 500,
        },
        link: {
            fontFamily: getFontFamily(500),
            fontSize: 13,
            lineHeight: 24,
            color: theme.colors.linkPrimary,
            fontWeight: 500,
        },
        linkPositive: {
            fontFamily: getFontFamily(500),
            fontSize: 13,
            lineHeight: 24,
            color: theme.colors.positive,
            fontWeight: 500,
        },
        mono: {
            fontFamily: getMonoFontFamily(400),
            fontSize: 13,
            lineHeight: 24,
            color: theme.colors.textMain,
            fontWeight: 400,
        },
    }

    return typography[variant]
}

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
    fontWeight: weight,
})
