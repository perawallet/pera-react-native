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

import { useCallback, useEffect, useRef } from 'react'
import { CHART_FOCUS_DEBOUNCE_TIME } from '@constants/ui'

/** Reports a focused index, or null once the touch ends. */
export type ChartSelectionReporter = (index: number | null) => void

/**
 * Throttles scrub-index changes down to the rate the header can absorb.
 *
 * Leading *and* trailing: the trailing call is what stops a finger that comes
 * to rest between windows from leaving the header showing the wrong date for
 * the remainder of the gesture. Release is never throttled — it restores the
 * live balance.
 */
export const useChartSelectionReporter = <T>(
    series: T[] | undefined,
    onSelectionChanged: (item: T | null) => void,
): ChartSelectionReporter => {
    // Read through a ref so a new series or callback identity doesn't change
    // the reporter's identity mid-gesture.
    const latest = useRef({ series, onSelectionChanged })
    latest.current = { series, onSelectionChanged }

    const lastSentAt = useRef(0)
    const trailingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const send = useCallback((index: number | null) => {
        lastSentAt.current = Date.now()
        const { series: currentSeries, onSelectionChanged: notify } =
            latest.current
        notify(index === null ? null : (currentSeries?.[index] ?? null))
    }, [])

    useEffect(
        () => () => {
            if (trailingTimer.current) clearTimeout(trailingTimer.current)
        },
        [],
    )

    return useCallback(
        (index: number | null) => {
            if (trailingTimer.current) {
                clearTimeout(trailingTimer.current)
                trailingTimer.current = null
            }

            if (index === null) {
                send(null)
                return
            }

            const elapsed = Date.now() - lastSentAt.current
            if (elapsed >= CHART_FOCUS_DEBOUNCE_TIME) {
                send(index)
                return
            }

            trailingTimer.current = setTimeout(
                () => send(index),
                CHART_FOCUS_DEBOUNCE_TIME - elapsed,
            )
        },
        [send],
    )
}
