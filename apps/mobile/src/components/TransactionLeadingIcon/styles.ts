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

import { makeStyles, type Theme } from '@rneui/themed'

export type TransactionLeadingIconSize = 'md' | 'lg'

type StyleProps = { size: TransactionLeadingIconSize }

export const useStyles = makeStyles((theme: Theme, { size }: StyleProps) => {
    const isLarge = size === 'lg'
    // The slot a list row (48) or a detail hero (72) gives the icon.
    const slot = isLarge ? theme.spacing['4xl'] : theme.spacing['3xl']
    // The pair is pushed just past the slot so the asset behind shows more of
    // itself without shifting the layout around it.
    const pairOverhang = isLarge ? theme.spacing.xs : theme.spacing.xxs
    // No token sits between xl (24) and xxl (36); 28 fits the row's sm glyph inside its ring.
    // lanekeep-ignore-next-line pera/no-numeric-sizes reason: the row badge is xl + xs (28), between two tokens
    const rowBadge = theme.spacing.xl + theme.spacing.xs
    const badge = isLarge ? theme.spacing.xxl : rowBadge

    return {
        pair: {
            width: slot,
            height: slot,
        },
        pairFrom: {
            position: 'absolute',
            top: -pairOverhang,
            left: -pairOverhang,
        },
        pairTo: {
            position: 'absolute',
            bottom: -pairOverhang,
            right: -pairOverhang,
            zIndex: theme.zIndex.layer1,
            borderWidth: theme.borders.md,
            borderColor: theme.colors.background,
            borderRadius: theme.borderRadius.full,
        },
        chains: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        // Overlaps the chain before it; the ring in the background keeps the two distinct.
        stackedChain: {
            marginLeft: isLarge ? -theme.spacing.xxl : -theme.spacing.xl,
            borderWidth: theme.borders.md,
            borderColor: theme.colors.background,
            borderRadius: theme.borderRadius.full,
        },
        kindBadge: {
            position: 'absolute',
            right: -theme.spacing.xs,
            bottom: -theme.spacing.xs,
            width: badge,
            height: badge,
            borderRadius: theme.borderRadius.full,
            borderWidth: theme.borders.md,
            borderColor: theme.colors.background,
            // A mid grey that stands out over any icon without the weight of textMain;
            // the glyph's buttonPrimary colour (white, or gray-900 in dark) contrasts in both.
            backgroundColor: theme.colors.textGrayLighter,
            alignItems: 'center',
            justifyContent: 'center',
        },
    }
})
