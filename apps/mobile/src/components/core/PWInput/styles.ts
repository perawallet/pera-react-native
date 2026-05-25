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
        // Pad the text instead of relying on RNEInput's fixed minHeight (40),
        // so the field grows with the font (e.g. larger Dynamic Type sizes)
        // while keeping a constant gap above and below the text.
        paddingVertical: theme.spacing.md,
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
