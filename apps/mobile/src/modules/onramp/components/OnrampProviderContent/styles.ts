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
    list: {
        gap: theme.spacing.xs,
    },
    // Overrides PWRadioButton's default vertical padding to keep rows compact.
    item: {
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: 0,
    },
    // Single row: label (left) + amount column (right), sat beside the radio.
    itemRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        flex: 1,
        minWidth: 0,
    },
    itemLabel: {
        color: theme.colors.textMain,
        flexShrink: 1,
        minWidth: 0,
    },
    rightColumn: {
        alignItems: 'flex-end',
    },
    amountText: {
        color: theme.colors.textMain,
    },
    feeText: {
        color: theme.colors.textGray,
    },
}))
