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

export const useStyles = makeStyles(theme => ({
    content: {
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.lg,
        gap: theme.spacing.xl,
    },
    // Balance
    balanceBlock: {
        gap: theme.spacing.xs,
    },
    balanceLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    // Pera Card thumbnail; sized to the 24x24 box in the design, contained so
    // the card keeps its aspect ratio and sits centered.
    balanceCardIcon: {
        width: theme.spacing.xl,
        height: theme.spacing.xl,
    },
    balanceLabel: {
        color: theme.colors.textGray,
    },
    // Compact funding row: hugs its content (icon + label + chevron) instead
    // of stretching edge-to-edge.
    fundingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: theme.spacing.xs,
    },
    fundingTextGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    fundingLabel: {
        color: theme.colors.textGray,
    },
    // Action buttons (stacked)
    buttons: {
        gap: theme.spacing.md,
    },
    // Generic section (credits)
    section: {
        gap: theme.spacing.md,
    },
    sectionDescription: {
        color: theme.colors.textGray,
    },
    rowGroup: {
        gap: theme.spacing.sm,
    },
    cardRow: {
        backgroundColor: theme.colors.layerGrayLightest,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        borderRadius: theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
    },
    rowRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    rowValue: {
        color: theme.colors.textMain,
    },
    // Transactions
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
    },
    monthHeader: {
        color: theme.colors.textGray,
        textAlign: 'center',
        marginTop: theme.spacing.sm,
        marginBottom: theme.spacing.xs,
    },
    txRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
    },
    txTextBlock: {
        flex: 1,
        minWidth: 0,
    },
    txSubtitle: {
        color: theme.colors.textGray,
    },
    txAmountDebit: {
        color: theme.colors.negative,
    },
    txAmountCredit: {
        color: theme.colors.positive,
    },
}))
