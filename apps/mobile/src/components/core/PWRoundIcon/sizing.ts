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

import { getIconPixelSize, type PWIconSize } from '@components/core/PWIcon'

export type PWRoundIconSize = 'sm' | 'md' | 'lg' | 'xl'

type SpacingToken = keyof Theme['spacing']

/**
 * Each round-icon size maps to a glyph size token and a padding token. The
 * circle diameter is computed from these — no raw pixels. Matches the four
 * round-icon formats in Figma (24 / 40 / 72 / 80 px circles).
 */
export const ROUND_ICON_SIZE_MAP: Record<
    PWRoundIconSize,
    { icon: PWIconSize; padding: SpacingToken }
> = {
    sm: { icon: 'sm', padding: 'xs' }, // 16 + 2*4 = 24
    md: { icon: 'md', padding: 'sm' }, // 24 + 2*8 = 40
    lg: { icon: 'md', padding: 'xl' }, // 24 + 2*24 = 72
    xl: { icon: 'xl', padding: 'lg' }, // 48 + 2*16 = 80
}

export type RoundIconDimensions = {
    diameter: number
    iconSize: PWIconSize
    padding: number
}

export const getRoundIconDimensions = (
    theme: Theme,
    size: PWRoundIconSize,
): RoundIconDimensions => {
    const { icon, padding } = ROUND_ICON_SIZE_MAP[size]
    const paddingPx = theme.spacing[padding]
    const iconPx = getIconPixelSize(theme, icon)
    return {
        diameter: iconPx + 2 * paddingPx,
        iconSize: icon,
        padding: paddingPx,
    }
}
