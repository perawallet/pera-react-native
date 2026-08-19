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
import { Decimal } from 'decimal.js'
import {
    type HistoryPeriod,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { percentChange } from '@perawallet/wallet-core-blockchain'
import {
    type AssetPriceHistoryItem,
    useAssetPriceHistoryQuery,
} from '@perawallet/wallet-core-assets'

type UsePriceTrendParams = {
    assetId: string
    period: HistoryPeriod
    selectedDataPoint?: Nullable<AssetPriceHistoryItem>
}

type UsePriceTrendResult = {
    changePercentage: Decimal
    changeValue: Decimal
    isPositive: boolean
    /**
     * True when there is nothing truthful to show: the price fetch is
     * offline-paused with no data (fresh or persisted), or the active
     * network has no Pera backend at all. Rendering would fake a 0.00%
     * trend (PERA-4581).
     */
    isHidden: boolean
}

export const usePriceTrend = ({
    assetId,
    period,
    selectedDataPoint,
}: UsePriceTrendParams): UsePriceTrendResult => {
    const {
        data: chartData,
        isPaused,
        isUnavailableOnNetwork,
    } = useAssetPriceHistoryQuery(assetId, period)

    const [changePercentage, changeValue] = useMemo(() => {
        const dataPoints = chartData?.map(p => p.usdPrice) ?? []

        const firstDp = dataPoints.at(0) ?? new Decimal(0)
        const lastDp =
            selectedDataPoint?.usdPrice ?? dataPoints.at(-1) ?? new Decimal(0)

        return [percentChange(firstDp, lastDp), lastDp.minus(firstDp)]
    }, [chartData, selectedDataPoint])

    const isPositive = changePercentage.greaterThanOrEqualTo(new Decimal(0))
    // Unavailable is permanent, not a connectivity blip — hide unconditionally
    // rather than showing a trend against stale data from a different network.
    const isHidden = isUnavailableOnNetwork || (isPaused && !chartData?.length)

    return { changePercentage, changeValue, isPositive, isHidden }
}
