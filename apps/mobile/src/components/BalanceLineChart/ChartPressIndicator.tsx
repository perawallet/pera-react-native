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
    Circle,
    DashPathEffect,
    Group,
    Line as SkiaLine,
    vec,
} from '@shopify/react-native-skia'
import { useDerivedValue } from 'react-native-reanimated'
import { CHART_POINTER_DOT_RADIUS, CHART_POINTER_DASH } from '@constants/ui'

import type { BalanceChartPressState } from './useChartPressSelection'

type ChartPressIndicatorProps = {
    pressState: BalanceChartPressState
    /** Chart bounds, so the strip spans the full plot height. */
    top: number
    bottom: number
    stripColor: string
    dotColor: string
}

// Everything here reads straight from the press state's shared values, so the
// strip and dot track the finger on the UI thread with no React render per
// sample.
//
// Visibility included: this stays mounted and fades via a derived opacity
// rather than being conditionally rendered on the hook's JS `isActive`
// boolean. That boolean arrives through runOnJS + a setState, so gating on it
// put appearing and disappearing behind the very thread that's congested
// during a scrub — seconds of lag at both ends of the gesture (PERA-4849).
export const ChartPressIndicator = ({
    pressState,
    top,
    bottom,
    stripColor,
    dotColor,
}: ChartPressIndicatorProps) => {
    const opacity = useDerivedValue(() => (pressState.isActive.value ? 1 : 0))
    const stripStart = useDerivedValue(() =>
        vec(pressState.x.position.value, top),
    )
    const stripEnd = useDerivedValue(() =>
        vec(pressState.x.position.value, bottom),
    )

    return (
        <Group opacity={opacity}>
            <SkiaLine
                p1={stripStart}
                p2={stripEnd}
                color={stripColor}
                strokeWidth={1}
            >
                <DashPathEffect intervals={CHART_POINTER_DASH} />
            </SkiaLine>
            <Circle
                cx={pressState.x.position}
                cy={pressState.y.value.position}
                r={CHART_POINTER_DOT_RADIUS}
                color={dotColor}
            />
        </Group>
    )
}
