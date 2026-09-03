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

import { memo, useMemo } from 'react'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { BalanceLineChart } from '@components/BalanceLineChart'
import type { HistoryPeriod, Nullable } from '@perawallet/wallet-core-shared'
import {
    type AccountBalanceHistoryItem,
    useAccountBalancesHistoryQuery,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

export type WealthChartProps = {
    account?: WalletAccount
    period: HistoryPeriod
    onSelectionChanged: (item: Nullable<AccountBalanceHistoryItem>) => void
    /** Gate the (slow) history fetch on chart visibility. */
    enabled?: boolean
}

const getPreferredValue = (item: AccountBalanceHistoryItem): number =>
    item.preferredValue.toNumber()

// Memoised because the account header re-renders on every scrub sample it
// receives. Without this each sample re-rendered CartesianChart — re-deriving
// the d3 scales and Skia paths — purely to redraw a line that hadn't changed.
export const WealthChart = memo(function WealthChart({
    onSelectionChanged,
    account,
    period,
    enabled = true,
}: WealthChartProps) {
    const themeStyle = useStyles()
    const { t } = useLanguage()

    const accounts = useAllAccounts()
    const addresses = useMemo(
        () =>
            account
                ? [account.address]
                : accounts.map((a: WalletAccount) => a.address),
        [account, accounts],
    )

    const {
        data,
        isPending,
        isError,
        isPaused,
        refetch,
        isUnavailableOnNetwork,
    } = useAccountBalancesHistoryQuery(addresses, period, enabled)

    return (
        <BalanceLineChart
            series={data}
            getValue={getPreferredValue}
            onSelectionChanged={onSelectionChanged}
            isPending={isPending}
            isError={isError}
            isPaused={isPaused}
            isUnavailableOnNetwork={isUnavailableOnNetwork}
            onRetry={() => void refetch()}
            emptyBody={t('common.wealth_chart.empty_body')}
            style={themeStyle.container}
        />
    )
})
