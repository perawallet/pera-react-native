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
import { getFontFamily } from './theme'

export type TypographyVariant =
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'body'
    | 'caption'
    | 'link'

export const getTypography = (
    theme: Theme,
    variant: TypographyVariant,
): TextStyle => {
    const typography: Record<TypographyVariant, TextStyle> = {
        h1: {
            fontFamily: getFontFamily(false, 500),
            fontSize: 32,
            lineHeight: 40,
            color: theme.colors.textMain,
        },
        h2: {
            fontFamily: getFontFamily(false, 500),
            fontSize: 25,
            lineHeight: 24,
            color: theme.colors.textMain,
        },
        h3: {
            fontFamily: getFontFamily(false, 500),
            fontSize: 19,
            lineHeight: 24,
            color: theme.colors.textMain,
        },
        h4: {
            fontFamily: getFontFamily(false, 500),
            fontSize: 15,
            lineHeight: 24,
            color: theme.colors.textMain,
        },
        body: {
            fontFamily: getFontFamily(false, 400),
            fontSize: 13,
            color: theme.colors.textMain,
        },
        caption: {
            fontFamily: getFontFamily(false, 400),
            fontSize: 11,
            color: theme.colors.textMain,
        },
        link: {
            fontFamily: getFontFamily(false, 400),
            fontSize: 13,
            color: theme.colors.linkPrimary,
        },
    }

    return typography[variant]
}

