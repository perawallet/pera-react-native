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
import { getTypography } from '@theme/typography'

// Frame, label and spacing live in the shared `AmountField`; this only holds the
// balance row, amount-text typography and the PWInput resets passed as slots.
export const useStyles = makeStyles(theme => ({
    balance: {
        color: theme.colors.textGray,
    },
    balanceWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        minWidth: 0,
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
    currencyPrefix: {
        marginRight: theme.spacing.xs,
    },
    fiatValue: {
        color: theme.colors.textGray,
    },
}))
