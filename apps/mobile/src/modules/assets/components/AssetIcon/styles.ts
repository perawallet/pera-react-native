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

const INITIALS_FONT_RATIO = 0.35

type StyleProps = {
    resolvedSize: number
    shape: 'circle' | 'square'
}

export const useStyles = makeStyles(
    (theme, { resolvedSize, shape }: StyleProps) => {
        const radius =
            shape === 'square' ? theme.borderRadius.sm : resolvedSize / 2
        const initialsText = {
            color: theme.colors.textGray,
            fontSize: resolvedSize * INITIALS_FONT_RATIO,
        }
        return {
            container: {
                alignItems: 'center',
                justifyContent: 'center',
                width: resolvedSize,
                height: resolvedSize,
                overflow: 'hidden',
                borderRadius: radius,
                borderWidth: theme.borders.sm,
                borderColor: 'transparent',
            },
            imageIcon: {
                width: resolvedSize,
                height: resolvedSize,
            },
            icon: {
                backgroundColor: theme.colors.background,
                width: resolvedSize,
                height: resolvedSize,
            },
            defaultAsset: {
                backgroundColor: theme.colors.layerGrayLighter,
                alignItems: 'center',
                justifyContent: 'center',
                width: resolvedSize,
                height: resolvedSize,
                borderRadius: radius,
                borderWidth: theme.borders.sm,
                borderColor: theme.colors.layerGrayLighter,
            },
            initialsText,
        }
    },
)
