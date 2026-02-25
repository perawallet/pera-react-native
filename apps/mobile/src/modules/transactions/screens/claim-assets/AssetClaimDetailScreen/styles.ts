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
import { EdgeInsets } from 'react-native-safe-area-context'

export const useStyles = makeStyles((theme, insets: EdgeInsets)  => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.spacing.xl,
        marginBottom: insets.bottom,
    },
    scrollContent: {
        flex: 1,
    },
    amountSection: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.xl,
        gap: theme.spacing.xs,
    },
    assetIdRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    copyIdPill: {
        backgroundColor: theme.colors.layerGrayLighter,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.spacing.lg,
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
        gap: theme.spacing.md,
    },
    sendersHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    senderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    senderAmountText: {
        color: theme.colors.success,
    },
    footer: {
        flexDirection: 'row',
        gap: theme.spacing.md,
        marginBottom: theme.spacing.xl
    },
    rejectButton: {
        flex: 2,
    },
    claimButton: {
        flex: 3,
    },
    usdText: {
        color: theme.colors.textGray,
    },
    headerLabelText: {
        color: theme.colors.textGray,
    },
    algoGainRow: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.lg,
    },
    algoGainText: {
        flexShrink: 1,
        flexWrap: 'wrap',
    },
    algoGainIcon: {
        marginTop: theme.spacing.xs
    }
}))
