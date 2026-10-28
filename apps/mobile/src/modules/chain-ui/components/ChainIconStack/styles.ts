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

import { makeStyles } from '@rneui/themed'

// Matches the design's 20px chain icons and "+N" chip.
export const CHAIN_ICON_SIZE = 20

export const useStyles = makeStyles(theme => ({
    chainIconStack: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    // Overlaps the icon before it; the ring in the row's background keeps the two distinct.
    stackedChainIcon: {
        marginLeft: -theme.spacing.xs,
        borderWidth: theme.borders.md,
        borderColor: theme.colors.background,
        borderRadius: theme.borderRadius.full,
    },
    // Sits inside the same ring as the icons, so it matches their size and stays
    // distinct from the icon it overlaps.
    moreChains: {
        width: CHAIN_ICON_SIZE,
        height: CHAIN_ICON_SIZE,
        borderRadius: theme.borderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        backgroundColor: theme.colors.background,
    },
    moreChainsLabel: {
        color: theme.colors.textGray,
    },
}))
