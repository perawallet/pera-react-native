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
import { getTypography, TypographyVariant } from '@theme/typography'

type PWInputStyleProps = {
    variant: TypographyVariant
}

export const useStyles = makeStyles((theme, { variant }: PWInputStyleProps) => {
    const input = {
        ...getTypography(theme, variant),
        lineHeight: undefined,
        // Fill the row so the placeholder has the full width and never wraps to
        // a second line (RN TextInput has no maxLines for placeholders).
        flex: 1,
        // No vertical padding: the field's min height centers the single line,
        // so the placeholder/value never looks top-aligned. `textAlignVertical`
        // pins it centered on Android too.
        paddingVertical: 0,
        textAlignVertical: 'center' as const,
    }
    return {
        // RNEInput defaults its outer container to paddingHorizontal: 10, which
        // insets every field past the screen gutter. Zero it so inputs align
        // flush with surrounding content; callers can still override.
        container: {
            paddingHorizontal: 0,
        },
        inputContainer: {
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.borderRadius.xs,
        },
        input,
    }
})
