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
    card: {
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGray,
        borderRadius: 16,
        paddingHorizontal: theme.spacing.xl,
        paddingVertical: theme.spacing.lg,
        gap: theme.spacing.lg,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    infoRowValue: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    labelText: {
        color: theme.colors.textGray,
    },
    toggleSection: {
        gap: theme.spacing.md,
        alignItems: 'center',
    },
    toggleDivider: {
        width: '100%',
    },
    toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs + 2,
    },
    toggleText: {
        color: theme.colors.textGray,
    },
    // Wallet structure tree styles
    treeContainer: {
        gap: theme.spacing.lg,
    },
    walletRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.lg,
    },
    connectorContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginLeft: 20,
    },
    connectorVertical: {
        width: 0,
        height: 32,
        borderLeftWidth: theme.borders.sm,
        borderLeftColor: theme.colors.layerGray,
    },
    connectorHorizontal: {
        width: 22,
        height: 0,
        borderTopWidth: theme.borders.sm,
        borderTopColor: theme.colors.layerGray,
    },
    accountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.lg,
    },
    accountRowWithConnector: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    accountInfo: {
        flexDirection: 'column',
    },
    addressText: {
        color: theme.colors.textGrayLighter,
    },
    scanButton: {
        backgroundColor: theme.colors.buttonSquareBg,
        borderRadius: theme.spacing.sm,
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        marginLeft: 56,
    },
    scanButtonText: {
        color: theme.colors.buttonSquareIcon,
    },
    minBalanceDescription: {
        color: theme.colors.textGray,
    },
}))
