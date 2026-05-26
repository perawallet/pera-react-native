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

// Native parity: 48dp icon on the left, 36dp close circle on the right.
const ICON_SIZE = 48

export const useStyles = makeStyles(theme => ({
    // PagerView (multi-banner only) needs an explicit height; size it to the
    // card's natural height (icon + equal vertical padding). The single-banner
    // path skips the pager and wraps content.
    pager: {
        height: ICON_SIZE + theme.spacing.lg * 2,
    },
    page: {
        paddingHorizontal: theme.spacing.md,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.background,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
    },
    iconWrapper: {
        width: ICON_SIZE,
        height: ICON_SIZE,
        marginVertical: theme.spacing.md,
        borderRadius: theme.borderRadius.full,
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        width: ICON_SIZE,
        height: ICON_SIZE,
    },
    text: {
        ...getTypography(theme, 'body'),
        flexGrow: 1,
        flexShrink: 1,
        color: theme.colors.textMain,
        flexWrap: 'wrap',
    },
    dismissButton: {
        borderRadius: theme.borderRadius.full,
        marginTop: theme.spacing.md,
        alignItems: 'center',
        alignSelf: 'flex-start',
        justifyContent: 'center',
        backgroundColor: theme.colors.layerGrayLighter,
        padding: theme.spacing.xxs,
    },
    dotsContainer: {
        flexDirection: 'row',
        alignSelf: 'center',
        gap: theme.spacing.xs,
    },
    dot: {
        width: theme.spacing.xs,
        height: theme.spacing.xs,
        borderRadius: theme.borderRadius.full,
        backgroundColor: theme.colors.layerGrayLighter,
    },
    dotActive: {
        width: theme.spacing.lg,
        backgroundColor: theme.colors.textMain,
    },
}))
