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
import { getFontWeightVariant } from '@theme/typography'

// Matches the design's 20px chain icons and "+N" chip.
export const CHAIN_ICON_SIZE = 20

export const useStyles = makeStyles(theme => ({
    container: {
        gap: theme.spacing.sm,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.lg,
    },
    info: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        flexShrink: 1,
    },
    title: {
        ...getFontWeightVariant(theme, 'h4', 500),
        flexShrink: 1,
    },
    suspiciousTitle: {
        ...getFontWeightVariant(theme, 'h4', 500),
        color: theme.colors.error,
        flexShrink: 1,
    },
    subtitle: {
        color: theme.colors.textGray,
    },
    // Starts at the text column: the xl asset icon plus the row gap.
    networksRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginLeft: theme.spacing['3xl'] + theme.spacing.lg,
    },
    networksToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        flexShrink: 1,
    },
    networksToggleLabel: {
        ...getFontWeightVariant(theme, 'h4', 500),
        color: theme.colors.linkPrimary,
        flexShrink: 1,
    },
    chainIconStack: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: theme.spacing.sm,
    },
    // Overlaps the icon before it; the ring in the row's background keeps the two distinct.
    stackedChainIcon: {
        marginLeft: -theme.spacing.xs,
        borderWidth: theme.borders.md,
        borderColor: theme.colors.background,
        borderRadius: theme.borderRadius.full,
    },
    moreChains: {
        width: CHAIN_ICON_SIZE,
        height: CHAIN_ICON_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        backgroundColor: theme.colors.background,
    },
    moreChainsLabel: {
        color: theme.colors.textGray,
    },
    chainLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    chevronExpanded: {
        transform: [{ rotate: '180deg' }],
    },
    amountContainer: {
        alignItems: 'flex-end',
        marginLeft: theme.spacing.md,
    },
    primaryAmount: {
        ...getFontWeightVariant(theme, 'h4', 500),
        textAlign: 'right',
    },
    secondaryAmount: {
        textAlign: 'right',
        color: theme.colors.textGray,
        alignSelf: 'flex-end',
    },
}))
