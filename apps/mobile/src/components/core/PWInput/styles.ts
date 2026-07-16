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

import { Platform } from 'react-native'
import { makeStyles } from '@rneui/themed'
import { getTypography, type TypographyVariant } from '@theme/typography'

type PWInputStyleProps = {
    variant: TypographyVariant
    // Runtime-scaled size emulating `adjustsFontSizeToFit` for the underlying
    // <TextInput>; overrides the variant's font size when set.
    fittedFontSize?: number
}

export const useStyles = makeStyles(
    (theme, { variant, fittedFontSize }: PWInputStyleProps) => {
        const input = {
            ...getTypography(theme, variant),
            ...(fittedFontSize ? { fontSize: fittedFontSize } : {}),
            lineHeight: undefined,
            // Full width so the placeholder doesn't wrap (RN TextInput has no
            // maxLines for placeholders).
            flex: 1,
            paddingVertical: 0,
            // Pin the single line centered on Android.
            textAlignVertical: 'center' as const,
            // RNW doesn't reset the browser's default :focus-visible ring;
            // longhand is required since RNW rejects the `outline` shorthand.
            ...(Platform.OS === 'web'
                ? ({ outlineStyle: 'none' } as unknown as object)
                : null),
        }
        return {
            // Zero RNEInput's default outer paddingHorizontal: 10 so fields
            // align flush with surrounding content.
            container: {
                paddingHorizontal: 0,
            },
            inputContainer: {
                paddingHorizontal: theme.spacing.md,
                borderRadius: theme.borderRadius.xs,
            },
            input,
        }
    },
)
