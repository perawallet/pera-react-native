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
import type { TextStyle, ViewStyle } from 'react-native'

/**
 * Shared layout primitives for the rekey confirm screens (standard / ledger /
 * shared / undo). Each screen owns its own `styles.ts` that wraps this in a
 * `makeStyles` factory — that way every style key the screen uses is declared
 * in its own file and stays visible to the no-unused-style-keys check.
 *
 * These screens render inside `PWScreen`, whose body/footer zones own the
 * horizontal + bottom padding. So `scrollContent`/`footer` here only carry the
 * inner gaps (and `scrollContent` keeps `flex: 1` so its `spacer` can push the
 * content down to the footer).
 */
export const getConfirmScreenStyles = (
    theme: Theme,
): Record<
    | 'container'
    | 'scrollContent'
    | 'summarySection'
    | 'spacer'
    | 'summaryLabel'
    | 'learnMore'
    | 'summaryCard'
    | 'arrowRow'
    | 'currentAuthRow'
    | 'row'
    | 'rowLabel'
    | 'footer'
    | 'underfundedNotice'
    | 'cta',
    ViewStyle | TextStyle
> => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        flex: 1,
        gap: theme.spacing.xl,
    },
    summarySection: {
        gap: theme.spacing.lg,
    },
    spacer: {
        flexGrow: 1,
    },
    summaryLabel: {
        color: theme.colors.textGray,
    },
    learnMore: {
        color: theme.colors.linkPrimary,
    },
    summaryCard: {
        gap: theme.spacing.md,
    },
    arrowRow: {
        width: theme.spacing.xxl,
        alignItems: 'center',
    },
    // The auth account name can be long, so this row stacks the label above
    // the account value instead of placing them side by side like `row`.
    currentAuthRow: {
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: theme.spacing.sm,
    },
    rowLabel: {
        color: theme.colors.textGray,
    },
    footer: {
        gap: theme.spacing.md,
    },
    underfundedNotice: {
        color: theme.colors.negative,
    },
    cta: {
        paddingVertical: theme.spacing.lg,
    },
})
