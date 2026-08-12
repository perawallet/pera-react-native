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

import { useCallback, useRef } from 'react'
import { CHART_FOCUS_DEBOUNCE_TIME } from '@constants/ui'

type ChartPointerEvent = {
    pointerIndex: number
    pointerX: number
}

// Debounced pointer-focus handler shared by the balance/price line charts:
// reports the focused data item (or null when the pointer leaves) at most once
// per CHART_FOCUS_DEBOUNCE_TIME.
export const useChartPointerFocus = <T>(
    data: T[] | undefined,
    onSelectionChanged: (item: T | null) => void,
): ((event: ChartPointerEvent) => void) => {
    // Refs, not state: gifted-charts samples the pointer on every touch move,
    // so throttle bookkeeping in state re-rendered the chart (and the screen
    // above it) at the sample rate and re-created this callback each time.
    const lastSentIndex = useRef<number | undefined>(undefined)
    const lastSentTime = useRef(0)

    return useCallback(
        ({ pointerIndex: index, pointerX }: ChartPointerEvent) => {
            // gifted-charts zeroes pointerX to signal release, pointerVanishDelay
            // (150ms) after the touch ends — i.e. inside the throttle window.
            // Throttling that strands the selection on screen, so it bypasses.
            if (pointerX === 0) {
                if (lastSentIndex.current === undefined) return
                lastSentIndex.current = undefined
                lastSentTime.current = 0
                onSelectionChanged(null)
                return
            }

            if (index < 0 || index === lastSentIndex.current) return
            if (
                Date.now() - lastSentTime.current <=
                CHART_FOCUS_DEBOUNCE_TIME
            ) {
                return
            }

            lastSentIndex.current = index
            lastSentTime.current = Date.now()
            onSelectionChanged(data?.[index] ?? null)
        },
        [data, onSelectionChanged],
    )
}
