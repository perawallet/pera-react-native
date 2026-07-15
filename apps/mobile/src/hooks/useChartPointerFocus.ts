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

import { useCallback, useState } from 'react'
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
    const [lastSentIndex, setLastSentIndex] = useState<number>()
    const [lastSentTime, setLastSentTime] = useState<number>(Date.now())

    return useCallback(
        ({ pointerIndex: index, pointerX }: ChartPointerEvent) => {
            if (Date.now() - lastSentTime <= CHART_FOCUS_DEBOUNCE_TIME) return

            if (pointerX > 0 && index >= 0 && index !== lastSentIndex) {
                onSelectionChanged(data?.[index] ?? null)
                setLastSentIndex(index)
            } else if (pointerX === 0) {
                onSelectionChanged(null)
                setLastSentIndex(undefined)
            }
            setLastSentTime(Date.now())
        },
        [data, onSelectionChanged, lastSentIndex, lastSentTime],
    )
}
