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

import { useState, useCallback } from 'react'
import { HistoryPeriod } from '@perawallet/wallet-core-shared'

/**
 * A hook for managing chart interaction state including the time period and selected data point.
 *
 * @template TDataPoint The type of data point in the chart
 * @param initialPeriod The initial history period to display
 * @returns Chart interaction state and management methods
 *
 * @example
 * const { period, setPeriod, selectedPoint, setSelectedPoint } = useChartInteraction()
 */
export function useChartInteraction<TDataPoint = unknown>(
    initialPeriod: HistoryPeriod = 'one-week',
): {
    period: HistoryPeriod
    setPeriod: (period: HistoryPeriod) => void
    selectedPoint: TDataPoint | null
    setSelectedPoint: (point: TDataPoint | null) => void
    clearSelection: () => void
} {
    const [period, setPeriod] = useState<HistoryPeriod>(initialPeriod)
    const [selectedPoint, setSelectedPoint] = useState<TDataPoint | null>(null)

    const clearSelection = useCallback(() => {
        setSelectedPoint(null)
    }, [])

    return {
        period,
        setPeriod,
        selectedPoint,
        setSelectedPoint,
        clearSelection,
    }
}
