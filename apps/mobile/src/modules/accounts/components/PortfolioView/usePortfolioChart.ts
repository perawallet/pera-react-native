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

import { useCallback } from 'react'
import type { PortfolioValueHistoryItem } from '@perawallet/wallet-core-accounts'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type UsePortfolioChartProps = {
    setSelectedPoint: (selected: Nullable<PortfolioValueHistoryItem>) => void
    onDataSelected?: (selected: Nullable<PortfolioValueHistoryItem>) => void
}

export type UsePortfolioChartResult = {
    chartSelectionChanged: (
        selected: Nullable<PortfolioValueHistoryItem>,
    ) => void
}

export const usePortfolioChart = ({
    setSelectedPoint,
    onDataSelected,
}: UsePortfolioChartProps): UsePortfolioChartResult => {
    const chartSelectionChanged = useCallback(
        (selected: Nullable<PortfolioValueHistoryItem>) => {
            setSelectedPoint(selected)
            onDataSelected?.(selected)
        },
        [setSelectedPoint, onDataSelected],
    )

    return { chartSelectionChanged }
}
