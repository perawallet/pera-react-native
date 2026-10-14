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
import { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import {
    EXPANDABLE_PANEL_ANIMATION_DURATION,
    EXPANDABLE_PANEL_ANIMATION_EASING,
} from '@constants/ui'

type UsePortfolioTrendColumnResult = {
    /** False once the column has fully faded out: it then overlays the row
     *  instead of reserving width the title needs. */
    isTrendColumnInLayout: boolean
    trendColumnStyle: ReturnType<typeof useAnimatedStyle>
    handleTrendFadeOutEnd: () => void
}

export const usePortfolioTrendColumn = (
    isChartShown: boolean,
): UsePortfolioTrendColumnResult => {
    const [hasFadedOut, setHasFadedOut] = useState(!isChartShown)

    // Back in the layout before it fades in, so the title never sits under
    // visible trend text.
    if (isChartShown && hasFadedOut) {
        setHasFadedOut(false)
    }

    const handleTrendFadeOutEnd = useCallback(() => setHasFadedOut(true), [])

    // Timed to the chart's ExpandablePanel so the column moves with it. Only
    // leaves the layout once the fade completes: a re-show mid-fade cancels it
    // (`finished` is false), keeping the column in place.
    const trendColumnStyle = useAnimatedStyle(
        () => ({
            opacity: withTiming(
                isChartShown ? 1 : 0,
                {
                    duration: EXPANDABLE_PANEL_ANIMATION_DURATION,
                    easing: EXPANDABLE_PANEL_ANIMATION_EASING,
                },
                finished => {
                    if (finished && !isChartShown) {
                        scheduleOnRN(handleTrendFadeOutEnd)
                    }
                },
            ),
        }),
        [isChartShown, handleTrendFadeOutEnd],
    )

    return {
        isTrendColumnInLayout: isChartShown || !hasFadedOut,
        trendColumnStyle,
        handleTrendFadeOutEnd,
    }
}
