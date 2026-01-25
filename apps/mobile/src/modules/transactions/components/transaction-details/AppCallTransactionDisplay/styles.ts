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
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.lg,
    },
    detailsContainer: {
        width: '100%',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        color: theme.colors.textGray,
    },
    value: {
        color: theme.colors.textMain,
        fontWeight: '500',
    },
    innerTransactionsContainer: {
        width: '100%',
        marginTop: theme.spacing.md,
        borderTopWidth: 1,
        borderTopColor: theme.colors.layerGrayLighter,
    },
    innerTransactionsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
    },
    innerTransactionsTitle: {
        color: theme.colors.linkPrimary,
        fontWeight: '600',
    },
    innerTransactionsList: {
        paddingHorizontal: theme.spacing.lg,
        gap: theme.spacing.sm,
        paddingBottom: theme.spacing.md,
    },
    warningContainer: {
        backgroundColor: theme.colors.helperNegative + '20',
        padding: theme.spacing.md,
        borderRadius: theme.spacing.sm,
        alignItems: 'center',
        marginHorizontal: theme.spacing.lg,
    },
    warningText: {
        color: theme.colors.helperNegative,
        fontSize: 12,
        textAlign: 'center',
    },
}))
