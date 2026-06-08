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
        flexGrow: 1,
        marginTop: theme.spacing.md,
    },
    textContainer: {
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    amountValue: {
        color: theme.colors.textMain,
    },
    address: {
        gap: theme.spacing.md,
    },
    addressText: {
        color: theme.colors.textMain,
    },
    typeText: {
        color: theme.colors.textGray,
        flexWrap: 'nowrap',
    },
    secondaryAmountValue: {
        color: theme.colors.textGray,
    },
    amountContainer: {
        marginTop: theme.spacing.md,
        alignItems: 'center',
    },
    transactionIcon: {
        marginTop: theme.spacing.md,
    },
}))
