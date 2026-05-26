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
import { getTypography } from '@theme/typography'

export const useStyles = makeStyles(theme => ({
    container: {
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.md,
    },
    receiveContainer: {
        backgroundColor: theme.colors.layerGrayLighter,
        borderRadius: theme.spacing.xl,
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.xl,
        paddingBottom: theme.spacing.md,
        marginTop: theme.spacing.xl,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.sm,
    },
    label: {
        color: theme.colors.textGray,
        flexShrink: 0,
    },
    balance: {
        color: theme.colors.textGray,
    },
    // Shrinks so a long balance truncates within the row instead of running
    // off-screen; the "Balance:" label stays intact and the amount gives way.
    balanceWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        minWidth: 0,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
    },
    amountContainer: {
        flex: 1,
        minHeight: getTypography(theme, 'h2').lineHeight,
    },
    amountText: getTypography(theme, 'h2'),
    amountTextMuted: {
        ...getTypography(theme, 'h2'),
        color: theme.colors.textGrayLighter,
    },
    amountInputContainer: {
        paddingHorizontal: 0,
    },
    amountInputInnerContainer: {
        borderBottomWidth: 0,
        paddingHorizontal: 0,
        backgroundColor: 'transparent',
    },
    amountInput: {
        paddingLeft: 0,
    },
    fiatValueContainer: {
        minHeight: getTypography(theme, 'body').lineHeight,
        justifyContent: 'center' as const,
    },
    fiatValue: {
        color: theme.colors.textGray,
    },
}))
