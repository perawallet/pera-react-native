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
    type AssetPriceHistoryItem,
    type PeraAsset,
    useAssetPriceHistoryQuery,
} from '@perawallet/wallet-core-assets'

export type AssetPriceChartProps = {
    asset: PeraAsset
    period: HistoryPeriod
    onSelectionChanged: (item: Nullable<AssetPriceHistoryItem>) => void
}

export const AssetPriceChart = ({
    onSelectionChanged,
    asset,
    period,
}: AssetPriceChartProps) => {
    const themeStyle = useStyles()
    const { t } = useLanguage()

    const { data, isPending, isError, refetch } = useAssetPriceHistoryQuery(
        asset.assetId,
        period,
    )

    const dataPoints = useMemo(
        () =>
            data?.map(p => ({
                timestamp: p.datetime,
                value: p.usdPrice.toNumber(),
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
            emptyBody={t('asset_details.markets.chart_empty_body')}
            errorBody={t('asset_details.markets.something_went_wrong_body')}
            getPointerProps={getPointerProps}
            style={themeStyle.container}
        />
    )
}
