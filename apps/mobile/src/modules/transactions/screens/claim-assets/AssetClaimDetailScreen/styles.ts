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
        flex: 1,
    },
    scrollContent: {
        paddingBottom: theme.spacing['3xl'],
    },
    amountSection: {
        alignItems: 'center',
        paddingVertical: theme.spacing.xl,
        gap: theme.spacing.xs,
    },
    assetIdRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        marginTop: theme.spacing.sm,
    },
    copyIdPill: {
        backgroundColor: theme.colors.layerGrayLighter,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.spacing.sm,
    },
    separator: {
        height: theme.borders.sm,
        backgroundColor: theme.colors.layerGrayLighter,
        marginVertical: theme.spacing.md,
    },
    accountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.sm,
    },
    accountInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    sendersSection: {
        marginTop: theme.spacing.md,
    },
    sendersHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: theme.spacing.md,
    },
    senderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: theme.spacing.sm,
    },
    senderAmountText: {
        color: theme.colors.success,
    },
    footer: {
        flexDirection: 'row',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.lg,
        paddingHorizontal: theme.spacing.md,
    },
    rejectButton: {
        flex: 1,
    },
    claimButton: {
        flex: 2,
    },
    usdText: {
        color: theme.colors.textGray,
    },
    headerLabelText: {
        color: theme.colors.textGray,
    },
}))
