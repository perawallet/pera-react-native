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
import { palette } from '@theme/colors'

// The card art is a fixed-ratio brand asset; pin a height (per the project's
// image-sizing convention — no runtime aspect-ratio derivation).
const CARD_HEIGHT = 210

export const useStyles = makeStyles(theme => ({
    content: {
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.lg,
        gap: theme.spacing.xl,
    },
    // Card visual + reveal pill grouped together (12px gap per the design).
    cardBlock: {
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    cardContainer: {
        width: '100%',
        height: CARD_HEIGHT,
        borderRadius: theme.spacing.lg,
        overflow: 'hidden',
    },
    cardImage: {
        width: '100%',
        height: '100%',
    },
    // The two flip faces (masked front, secure back) stacked in the same box.
    // `backfaceVisibility: hidden` so only the face toward the viewer paints as
    // the card rotates around its Y axis.
    cardFace: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backfaceVisibility: 'hidden',
        borderRadius: theme.spacing.lg,
        overflow: 'hidden',
    },
    panContainer: {
        position: 'absolute',
        left: theme.spacing.lg,
        bottom: theme.spacing.lg,
    },
    // The card is an always-yellow brand surface, so the PAN is a static dark
    // (theme-independent) — same approach as BannerCard's fixed-surface text.
    pan: {
        color: palette.gray[900],
    },
    // Reveal pill: bordered, content-hugging row with an eye icon + label.
    revealPill: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        gap: theme.spacing.sm,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        borderRadius: theme.spacing.xl,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
    },
    revealLabel: {
        color: theme.colors.textGray,
    },
    // Generic labelled section ("Funding Account", "Options").
    section: {
        gap: theme.spacing.md,
    },
    sectionLabel: {
        color: theme.colors.textGray,
    },
    // Grouped funding selectors: one bordered card, a divider between rows.
    fundingGroup: {
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        borderRadius: theme.spacing.sm,
    },
    fundingGroupRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
    },
    fundingGroupValue: {
        gap: theme.spacing.xxs,
    },
    fundingGroupLabel: {
        color: theme.colors.textGray,
    },
    fundingGroupDivider: {
        height: theme.borders.sm,
        backgroundColor: theme.colors.layerGray,
    },
    changeLink: {
        color: theme.colors.linkPrimary,
    },
    // Options list.
    optionsList: {
        gap: theme.spacing.xxs,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.lg,
        paddingVertical: theme.spacing.lg,
    },
    optionLabelDestructive: {
        color: theme.colors.negative,
    },
    // Dims a row/button that is disabled for a reason other than a pending
    // spinner (e.g. offline) — mirrors PWRadioButton's disabled idiom.
    disabled: {
        opacity: 0.5,
    },
}))
