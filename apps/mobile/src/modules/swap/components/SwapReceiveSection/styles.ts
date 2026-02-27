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
    outerContainer: {
        backgroundColor: theme.colors.layerGrayLighter,
        borderRadius: theme.spacing.xl,
        flex: 1,
    },
    midRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.md,
    },
    swapDirectionButton: {
        width: theme.spacing['4xl'],
        height: theme.spacing['4xl'],
        borderRadius: theme.spacing['4xl'] / 2,
        backgroundColor: theme.colors.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    maxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    maxButton: {
        borderRadius: theme.spacing['3xl'],
        borderWidth: 1,
        borderColor: theme.colors.layerGray,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
    },
    maxText: {
        color: theme.colors.buttonSecondaryText,
        fontWeight: '600',
    },
    container: {
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.xl,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.sm,
    },
    label: {
        color: theme.colors.textGray,
    },
    balance: {
        color: theme.colors.textGray,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
    },
    amountContainer: {
        flex: 1,
    },
    amountText: {
        color: theme.colors.textMain,
    },
    fiatAmount: {
        color: theme.colors.textGray,
        marginTop: theme.spacing.xs,
    },
}))
