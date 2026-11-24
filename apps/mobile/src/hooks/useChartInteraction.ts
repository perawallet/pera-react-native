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

import { useState, useCallback } from 'react'
import {
    HISTORY_PERIODS,
    type HistoryPeriod,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'

const isHistoryPeriod = (value: unknown): value is HistoryPeriod =>
    HISTORY_PERIODS.includes(value as HistoryPeriod)

/**
 * `isPeriodShared`: the period is the one the balance charts share and remember;
 * off, the chart starts on `initialPeriod` and keeps its pick to itself.
 */
export function useChartInteraction<TDataPoint = unknown>(
    initialPeriod: HistoryPeriod = 'one-week',
    { isPeriodShared = true }: { isPeriodShared?: boolean } = {},
) {
    const { getPreference, setPreference } = usePreferences()
    const storedPeriod = isPeriodShared
        ? getPreference(UserPreferences.chartPeriod)
        : null
    const [period, setPeriodState] = useState<HistoryPeriod>(
        isHistoryPeriod(storedPeriod) ? storedPeriod : initialPeriod,
    )

    const setPeriod = useCallback(
        (value: HistoryPeriod) => {
            setPeriodState(value)
            if (isPeriodShared) {
                setPreference(UserPreferences.chartPeriod, value)
            }
        },
        [setPreference, isPeriodShared],
    )
    const [selectedPoint, setSelectedPoint] =
        useState<Nullable<TDataPoint>>(null)

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
