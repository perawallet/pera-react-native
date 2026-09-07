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
import { getTypography } from '@theme/typography'

export const useStyles = makeStyles(theme => ({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
        backgroundColor: theme.colors.bannerBg,
    },
    // Holds the icon + text. `flexShrink: 1` so a long text ellipsizes
    // instead of pushing the chevron off-screen. `minWidth: 0` is required on
    // the parent of a `flex` child for ellipsize to actually engage on web.
    iconTextGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        flexShrink: 1,
        minWidth: 0,
    },
    // Wraps the text and hosts the periodic opacity pulse.
    textWrapper: {
        flexShrink: 1,
        minWidth: 0,
    },
    text: {
        ...getTypography(theme, 'h4'),
        color: theme.colors.bannerText,
    },
    // Trailing cluster: optional "+N" badge sitting inline with the chevron.
    trailing: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    // Equal min dimensions keep it circular; padding alone would leave the
    // height short of the width. Opaque, because 18% was invisible on the mint
    // this sits on (`bannerBg`, the same turquoise in both themes).
    moreBadge: {
        minWidth: theme.spacing.xl + theme.spacing.xs,
        minHeight: theme.spacing.xl + theme.spacing.xs,
        paddingHorizontal: theme.spacing.xs,
        borderRadius: theme.borderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.white,
    },
    moreBadgeText: {
        ...getTypography(theme, 'captionMedium'),
        color: theme.colors.bannerText,
        textAlign: 'center',
    },
}))
