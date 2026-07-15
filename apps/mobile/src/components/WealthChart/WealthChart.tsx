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

import { useMemo } from 'react'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useChartPointerFocus } from '@hooks/useChartPointerFocus'
import { BalanceLineChart } from '@components/BalanceLineChart'
import {
    type HistoryPeriod,
    type Nullable,
} from '@perawallet/wallet-core-shared'
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

export const WealthChart = ({
    onSelectionChanged,
    account,
    period,
    enabled = true,
}: WealthChartProps) => {
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

    const { data, isPending, isError, refetch } =
        useAccountBalancesHistoryQuery(addresses, period, enabled)

    const dataPoints = useMemo(
        () =>
            data?.map(p => ({
                datetime: p.datetime,
                value: p.preferredValue.toNumber(),
            })) ?? [],
        [data],
    )

    const getPointerProps = useChartPointerFocus(data, onSelectionChanged)

    return (
        <BalanceLineChart
            dataPoints={dataPoints}
            isPending={isPending}
            isError={isError}
            onRetry={() => void refetch()}
            emptyBody={t('common.wealth_chart.empty_body')}
            getPointerProps={getPointerProps}
            style={themeStyle.container}
        />
    )
}
