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

import { memo } from 'react'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { BalanceLineChart } from '@components/BalanceLineChart'
import {
    type HistoryPeriod,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    type AccountAssetBalanceHistoryItem,
    useAccountsAssetsBalanceHistoryQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { type PeraAsset } from '@perawallet/wallet-core-assets'

export type AssetWealthChartProps = {
    account: WalletAccount
    asset: PeraAsset
    period: HistoryPeriod
    onSelectionChanged: (item: Nullable<AccountAssetBalanceHistoryItem>) => void
}

const getPreferredValue = (item: AccountAssetBalanceHistoryItem): number =>
    item.preferredValue.toNumber()

// Memoised like WealthChart: the history query rebuilds its results in an
// inline `select`, so an unmemoised re-render hands the chart a new data
// array and victory resets an in-progress scrub.
export const AssetWealthChart = memo(function AssetWealthChart({
    onSelectionChanged,
    account,
    asset,
    period,
}: AssetWealthChartProps) {
    const themeStyle = useStyles()
    const { t } = useLanguage()

    const {
        data,
        isPending,
        isError,
        isPaused,
        refetch,
        isUnavailableOnNetwork,
    } = useAccountsAssetsBalanceHistoryQuery(account, asset.assetId, period)

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
            emptyBody={t('common.wealth_chart.asset_empty_body')}
            style={themeStyle.container}
        />
    )
})
