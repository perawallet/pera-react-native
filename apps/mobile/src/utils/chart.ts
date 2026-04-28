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

const PADDING_RATIO = 0.1

// gifted-charts positions each point at (value - yAxisOffset) / maxValue,
// so maxValue is the chart's *range*, not its top. The chart spans
// [yAxisOffset, yAxisOffset + maxValue] in data-value space.
export type ChartYAxisRange = {
    yAxisOffset: number
    maxValue: number
}

const FALLBACK: ChartYAxisRange = { yAxisOffset: -1, maxValue: 2 }

export const getChartYAxisRange = (
    dataPoints: readonly { value: number }[],
): ChartYAxisRange => {
    if (dataPoints.length === 0) return FALLBACK

    let dataMin = Infinity
    let dataMax = -Infinity
    for (const point of dataPoints) {
        if (point.value < dataMin) dataMin = point.value
        if (point.value > dataMax) dataMax = point.value
    }

    const range = dataMax - dataMin
    if (range > 0) {
        const padding = range * PADDING_RATIO
        return { yAxisOffset: dataMin - padding, maxValue: range + 2 * padding }
    }

    if (dataMax !== 0) {
        const padding = Math.abs(dataMax) * PADDING_RATIO
        return { yAxisOffset: dataMax - padding, maxValue: 2 * padding }
    }

    return FALLBACK
}
