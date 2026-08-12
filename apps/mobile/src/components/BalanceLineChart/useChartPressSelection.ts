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

import {
    runOnJS,
    useAnimatedReaction,
    type SharedValue,
} from 'react-native-reanimated'
import { useChartSelectionReporter } from './useChartSelectionReporter'

/** The subset of victory's ChartPressState this component reads. */
export type BalanceChartPressState = {
    isActive: SharedValue<boolean>
    matchedIndex: SharedValue<number>
    x: { position: SharedValue<number> }
    y: { value: { position: SharedValue<number> } }
}

/**
 * Bridges the UI-thread press state to the JS selection callback.
 *
 * The strip and dot render straight from shared values and never come through
 * here, so the only consumer is the header text — hence the throttling in
 * useChartSelectionReporter.
 */
export const useChartPressSelection = <T>(
    pressState: BalanceChartPressState,
    series: T[] | undefined,
    onSelectionChanged: (item: T | null) => void,
): void => {
    const report = useChartSelectionReporter(series, onSelectionChanged)

    useAnimatedReaction(
        () => ({
            isActive: pressState.isActive.value,
            index: pressState.matchedIndex.value,
        }),
        (current, previous) => {
            if (!current.isActive) {
                if (previous?.isActive) {
                    runOnJS(report)(null)
                }
                return
            }
            if (previous?.isActive && current.index === previous.index) return
            runOnJS(report)(current.index)
        },
    )
}
