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

export const useStyles = makeStyles(theme => {
    const amount = {
        color: theme.colors.textMain,
        fontWeight: '500' as const,
    }
    return {
        container: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingVertical: theme.spacing.md,
            gap: theme.spacing.md,
            width: '100%',
            minWidth: 0,
        },
        iconContainer: {
            justifyContent: 'center',
            alignItems: 'center',
            flexShrink: 0,
        },
        contentContainer: {
            flex: 1,
            minWidth: 0,
        },
        mainRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            minWidth: 0,
        },
        titleContainer: {
            flex: 1,
            minWidth: 0,
            marginRight: theme.spacing.sm,
        },
        // No fixed max-width: the amount sizes to its content and the title
        // (a short label + already-truncated address) yields the rest, so the
        // amount only truncates when the row genuinely can't fit it.
        amountContainer: {
            alignItems: 'flex-end',
            flexShrink: 1,
            minWidth: 0,
        },
        title: {
            color: theme.colors.textMain,
        },
        subtitle: {
            color: theme.colors.textGray,
            marginTop: theme.spacing.xxs,
        },
        amount,
        amountPositive: {
            color: theme.colors.positive,
        },
        amountNegative: {
            color: theme.colors.negative,
        },
    }
})
