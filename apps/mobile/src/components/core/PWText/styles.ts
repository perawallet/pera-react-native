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

import { makeStyles } from '@rneui/themed'
import { Platform } from 'react-native'
import {
    getFontWeightVariant,
    getTypography,
    type FontWeight,
    type TypographyVariant,
} from '@theme/typography'

type PWTextStyleProps = {
    variant: TypographyVariant
    weight?: FontWeight
}

export const useStyles = makeStyles(
    (theme, { variant, weight }: PWTextStyleProps) => ({
        text: {
            ...(weight === undefined
                ? getTypography(theme, variant)
                : getFontWeightVariant(theme, variant, weight)),
            ...Platform.select({
                android: {
                    includeFontPadding: false,
                },
            }),
        },
        truncate: {
            flexShrink: 1,
            minWidth: 0,
        },
    }),
)
