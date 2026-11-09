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

export const useStyles = makeStyles(theme => ({
    header: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.md,
        flexGrow: 1,
        marginTop: theme.spacing.md,
    },
    icon: {
        marginTop: theme.spacing.md,
    },
    titleContainer: {
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    title: {
        color: theme.colors.textGray,
        flexWrap: 'nowrap',
    },
    address: {
        gap: theme.spacing.md,
    },
    addressText: {
        color: theme.colors.textMain,
    },
    amountContainer: {
        marginTop: theme.spacing.md,
        alignItems: 'center',
    },
    amount: {
        color: theme.colors.textMain,
    },
    secondaryAmount: {
        color: theme.colors.textGray,
    },
    highFeeNotice: {
        marginBottom: theme.spacing.md,
    },
    participants: {
        gap: theme.spacing.xs,
    },
    caption: {
        color: theme.colors.textGray,
    },
    signingAccount: {
        backgroundColor: theme.colors.background,
        borderWidth: 0,
        padding: 0,
    },
    feeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    label: {
        color: theme.colors.textGray,
    },
    // One flex child, so the review's space-between can't pull the link away from its rows;
    // the gap stands in for the screen's, which fragment rows (EthereumTransferAssetRows) rely on.
    details: {
        gap: theme.spacing.lg,
    },
    transactionDetails: {
        alignSelf: 'flex-start',
        marginVertical: theme.spacing.sm,
    },
}))
