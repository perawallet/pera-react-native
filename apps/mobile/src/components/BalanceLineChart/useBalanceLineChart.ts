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
import { useNetworkStatus, useNetworkStatusStore } from '@modules/network'

/** Which of the chart container's mutually exclusive surfaces to render. */
export type BalanceLineChartRenderState =
    | 'chart'
    | 'offline'
    | 'error'
    | 'loading'
    | 'empty'

type UseBalanceLineChartParams = {
    /** True when the series has at least one point to plot (fresh or stale). */
    hasData: boolean
    /** True while the query's fetch is offline-paused (fetchStatus 'paused'). */
    isPaused: boolean
    isError: boolean
    isPending: boolean
    onRetry?: () => void
}

type UseBalanceLineChartResult = {
    renderState: BalanceLineChartRenderState
    handleRetry?: () => void
}

/**
 * PERA-4581 paused-state contract for charts (docs/OFFLINE_PAUSED_STATE.md):
 * last-known data always wins, then a distinct offline surface, then error,
 * then loading, then genuine emptiness. A paused query reports isPending
 * forever, so offline MUST be resolved before the spinner.
 */
export const useBalanceLineChart = ({
    hasData,
    isPaused,
    isError,
    isPending,
    onRetry,
}: UseBalanceLineChartParams): UseBalanceLineChartResult => {
    const { hasInternet } = useNetworkStatus()

    const renderState = useMemo<BalanceLineChartRenderState>(() => {
        if (hasData) {
            return 'chart'
        }
        if (isPaused || (isError && !hasInternet)) {
            return 'offline'
        }
        if (isError) {
            return 'error'
        }
        if (isPending) {
            return 'loading'
        }
        return 'empty'
    }, [hasData, isPaused, isError, isPending, hasInternet])

    const handleRetry = useMemo(() => {
        if (!onRetry) {
            return undefined
        }
        return () => {
            // Offline: skip the doomed request (30 s timeout) — the offline
            // copy on screen already promises a refresh on reconnect.
            if (!useNetworkStatusStore.getState().hasInternet) {
                return
            }
            onRetry()
        }
    }, [onRetry])

    return { renderState, handleRetry }
}
