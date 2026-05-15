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

/** Shared layout styles for all rekey confirm screens (standard / ledger / shared / undo). */
export const useConfirmScreenStyles = makeStyles(theme => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.xl,
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
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.lg,
        gap: theme.spacing.md,
    },
    cta: {
        paddingVertical: theme.spacing.lg,
    },
}))
