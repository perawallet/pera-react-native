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
import { MAX_FONT_SIZE_MULTIPLIER } from '@components/core/constants'
import { scaleLineHeight } from '@theme/scaling'
import { getTypography, type TypographyVariant } from '@theme/typography'
import { isAndroid, isIOS } from '@utils/platform'
import {
    DISCOVER_ROW_LEAD_SIZE,
    TOP_DAPPS_COUNT,
} from '../../utils/discoverLayout'

export const useStyles = makeStyles((theme, fontScale: number) => {
    const android = isAndroid()
    const requestedScale = (android || isIOS()) && fontScale > 0 ? fontScale : 1
    const nativeMultiplier = android
        ? requestedScale
        : Math.min(requestedScale, MAX_FONT_SIZE_MULTIPLIER)
    const renderedLineHeight = (variant: TypographyVariant) => {
        const { lineHeight, fontSize } = getTypography(theme, variant)
        const styleHeight = scaleLineHeight(
            lineHeight,
            fontSize,
            requestedScale,
            MAX_FONT_SIZE_MULTIPLIER,
        )
        return (styleHeight ?? 0) * nativeMultiplier
    }
    // lanekeep-ignore-next-line pera/no-numeric-sizes reason: DappRow has this vertical padding on both sides
    const rowPadding = 2 * theme.spacing.sm
    const rowHeight =
        Math.max(
            DISCOVER_ROW_LEAD_SIZE,
            renderedLineHeight('bodyLarge') +
                renderedLineHeight('footnoteMedium'),
        ) + rowPadding
    // lanekeep-ignore-next-line pera/no-numeric-sizes reason: RowDivider's line and both vertical margins occupy the preview
    const dividerHeight = theme.borders.sm + 2 * theme.spacing.xxs

    return {
        content: {
            gap: theme.spacing.xl,
            paddingHorizontal: theme.spacing.xl,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.xl,
        },
        section: {
            gap: theme.spacing.md,
            // Sections sit 40 apart (content gap 24 + 16).
            marginTop: theme.spacing.lg,
        },
        // A horizontal row that scrolls under the screen's side padding, edge to edge.
        bleed: {
            marginHorizontal: -theme.spacing.xl,
        },
        bleedContent: {
            paddingHorizontal: theme.spacing.xl,
        },
        // The last card's own right margin already gives part of the end inset.
        newsContent: {
            paddingLeft: theme.spacing.xl,
            paddingRight: theme.spacing.sm,
        },
        emptyDapps: {
            paddingVertical: theme.spacing.lg,
        },
        dappPreview: {
            minHeight:
                TOP_DAPPS_COUNT * rowHeight +
                (TOP_DAPPS_COUNT - 1) * dividerHeight,
        },
        dappLoadingRow: {
            height: rowHeight,
            alignItems: 'center',
            flexDirection: 'row',
            gap: theme.spacing.lg,
        },
        dappLoadingLogo: {
            height: DISCOVER_ROW_LEAD_SIZE,
            width: DISCOVER_ROW_LEAD_SIZE,
            borderRadius: theme.borderRadius.md,
        },
        dappLoadingName: {
            height: theme.spacing.lg,
            width: '40%',
        },
        newsCard: {
            // lanekeep-ignore-next-line pera/no-numeric-sizes reason: news card width (about two thirds of a phone screen, so the next card peeks)
            width: 240,
            marginRight: theme.spacing.lg,
        },
    }
})
