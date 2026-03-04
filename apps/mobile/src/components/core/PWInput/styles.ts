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
import { getTypography } from '@theme/typography'

type PWInputStyleProps = {
    variant: 'default' | 'numeric'
}

export const useStyles = makeStyles((theme, { variant }: PWInputStyleProps) => {
    const h2Typography = getTypography(theme, 'h2')

    const variantStyles = {
        default: {
            container: {},
            inputContainer: {},
            input: { paddingHorizontal: theme.spacing.sm },
        },
        numeric: {
            container: { paddingHorizontal: 0 },
            inputContainer: {
                borderBottomWidth: 0,
                paddingHorizontal: 0,
                backgroundColor: 'transparent' as const,
            },
            input: {
                fontFamily: h2Typography.fontFamily,
                fontSize: h2Typography.fontSize,
                fontWeight: h2Typography.fontWeight,
                color: theme.colors.textMain,
                paddingLeft: 0,
            },
        },
    }

    const v = variantStyles[variant]

    return {
        container: v.container,
        inputContainer: v.inputContainer,
        input: v.input,
        label: {},
    }
})
