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
    container: {
        paddingBottom: theme.spacing.xl,
    },
    headerCenter: {
        alignItems: 'center',
    },
    accountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        marginTop: theme.spacing.xs,
    },
    accountName: {
        color: theme.colors.textGray,
    },
    assetSection: {
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
    },
    assetRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    assetAmountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    amountTextContainer: {
        gap: theme.spacing.xs,
    },
    assetAmount: {
        color: theme.colors.textMain,
    },
    usdValue: {
        color: theme.colors.textGray,
    },
    toDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.lg,
        gap: theme.spacing.sm,
    },
    toLabel: {
        color: theme.colors.textGray,
    },
    detailsSection: {
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.lg,
        gap: theme.spacing.md,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    rateValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    detailLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    detailLabel: {
        color: theme.colors.textGray,
    },
    detailValue: {
        color: theme.colors.textMain,
    },
    priceImpactLow: {
        color: theme.colors.positive,
    },
    priceImpactMedium: {
        color: theme.colors.warning,
    },
    priceImpactHigh: {
        color: theme.colors.negative,
    },
    warningBanner: {
        marginHorizontal: theme.spacing.lg,
        marginTop: theme.spacing.md,
        padding: theme.spacing.md,
        backgroundColor: theme.colors.negativeLighter,
        borderRadius: theme.spacing.sm,
    },
    warningText: {
        color: theme.colors.negative,
    },
    errorBanner: {
        marginHorizontal: theme.spacing.lg,
        marginTop: theme.spacing.md,
        padding: theme.spacing.md,
        backgroundColor: theme.colors.negativeLighter,
        borderRadius: theme.spacing.sm,
    },
    errorText: {
        color: theme.colors.negative,
    },
    assetChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        backgroundColor: theme.colors.layerGrayLighter,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.spacing.sm,
    },
    assetChipText: {
        color: theme.colors.textMain,
    },
    confirmButton: {
        marginHorizontal: theme.spacing.lg,
        marginTop: theme.spacing.xl,
    },
}))
