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
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useNetworkStatus, useNetworkStatusStore } from '@modules/network'
import { useLanguage } from '@hooks/useLanguage'

/** Which of the chart container's mutually exclusive surfaces to render. */
export type BalanceLineChartRenderState =
    | 'chart'
    | 'unavailable'
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
    /** True when the active network has no Pera backend — the query is
     *  `enabled: false` and stays isPending forever, so this must be checked
     *  before pending/error or the UI hangs on a spinner that can never
     *  resolve. */
    isUnavailableOnNetwork: boolean
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
    isUnavailableOnNetwork,
    onRetry,
}: UseBalanceLineChartParams): UseBalanceLineChartResult => {
    const { hasInternet } = useNetworkStatus()
    const { request: requestBottomSheet } = useBottomSheet()
    const { t } = useLanguage()

    const renderState = useMemo<BalanceLineChartRenderState>(() => {
        if (hasData) {
            return 'chart'
        }
        if (isUnavailableOnNetwork) {
            return 'unavailable'
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
    }, [
        hasData,
        isPaused,
        isError,
        isPending,
        isUnavailableOnNetwork,
        hasInternet,
    ])

    const handleRetry = useMemo(() => {
        if (!onRetry) {
            return undefined
        }
        return () => {
            // Offline: firing the request would just hang for the 30 s timeout,
            // so instead of that (or a button that silently does nothing) explain
            // the situation and let the auto-refresh-on-reconnect wiring take over.
            if (!useNetworkStatusStore.getState().hasInternet) {
                void requestBottomSheet({
                    contents: (
                        <ConfirmActionContent
                            icon='globe'
                            iconVariant='warning'
                            title={t('common.offline_mode')}
                            message={t('common.offline_refresh_body')}
                            confirmLabel={t('common.ok.label')}
                            testID='balance-chart-offline-sheet'
                        />
                    ),
                    options: { size: 'auto', enablePanDownToClose: true },
                })
                return
            }
            onRetry()
        }
    }, [onRetry, requestBottomSheet, t])

    return { renderState, handleRetry }
}
