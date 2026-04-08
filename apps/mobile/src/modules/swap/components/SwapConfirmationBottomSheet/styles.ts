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
    summarySection: {
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.lg,
        gap: theme.spacing.md,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    summaryLabel: {
        color: theme.colors.textGray,
    },
    summaryAmount: {
        color: theme.colors.textMain,
    },
    arrowContainer: {
        paddingLeft: theme.spacing.sm,
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
    confirmButton: {
        marginHorizontal: theme.spacing.lg,
        marginTop: theme.spacing.xl,
    },
}))
