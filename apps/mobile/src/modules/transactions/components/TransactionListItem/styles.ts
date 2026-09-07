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

export const useStyles = makeStyles(theme => {
    const amount = {
        color: theme.colors.textMain,
        fontWeight: '500' as const,
    }
    return {
        // Dense transaction history: keep the compact vertical padding + gap
        // rather than the layout's default lg spacing.
        container: {
            paddingVertical: theme.spacing.md,
            gap: theme.spacing.md,
        },
        amountContainer: {
            alignItems: 'flex-end',
        },
        title: {
            color: theme.colors.textMain,
        },
        subtitle: {
            color: theme.colors.textGray,
            marginTop: theme.spacing.xxs,
        },
        pendingVerifying: {
            color: theme.colors.warningText,
            marginTop: theme.spacing.xxs,
        },
        amount,
        amountPositive: {
            color: theme.colors.positive,
        },
        amountNegative: {
            color: theme.colors.negative,
        },
        amountOverflow: {
            color: theme.colors.textGray,
            marginTop: theme.spacing.xxs,
        },
    }
})
