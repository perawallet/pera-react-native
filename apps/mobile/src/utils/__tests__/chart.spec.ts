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

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { getChartYAxisRange } from '../chart'

// Mirrors gifted-charts' position formula: (value - yAxisOffset) / maxValue.
const peakPosition = (
    { yAxisOffset, maxValue }: { yAxisOffset: number; maxValue: number },
    dataMax: number,
): number => (dataMax - yAxisOffset) / maxValue

const toPoints = (values: number[]) => values.map(value => ({ value }))

describe('getChartYAxisRange', () => {
    it('returns a symmetric range for empty data', () => {
        const result = getChartYAxisRange([])
        expect(result.yAxisOffset).toBe(-1)
        expect(result.maxValue).toBe(2)
    })

    it('returns a symmetric range when every value is zero', () => {
        const result = getChartYAxisRange(toPoints([0, 0, 0]))
        expect(result.yAxisOffset).toBe(-1)
        expect(result.maxValue).toBe(2)
    })

    it('places the peak at ~91.7% for a flat-baseline dataset with small variation', () => {
        const result = getChartYAxisRange(toPoints([999.5, 1000, 1000.5]))
        expect(peakPosition(result, 1000.5)).toBeCloseTo(11 / 12, 5)
    })

    it('places the peak at ~91.7% for a wide-variation positive dataset', () => {
        const result = getChartYAxisRange(toPoints([100, 500, 1000]))
        expect(peakPosition(result, 1000)).toBeCloseTo(11 / 12, 5)
    })

    it('produces a non-zero range that brackets the constant for flat positive data', () => {
        const { yAxisOffset, maxValue } = getChartYAxisRange(
            toPoints([100, 100, 100]),
        )
        expect(yAxisOffset).toBeLessThan(100)
        expect(yAxisOffset + maxValue).toBeGreaterThan(100)
        expect(maxValue).toBeGreaterThan(0)
    })

    it('produces a non-zero range that brackets the constant for flat negative data', () => {
        const { yAxisOffset, maxValue } = getChartYAxisRange(
            toPoints([-100, -100, -100]),
        )
        expect(yAxisOffset).toBeLessThan(-100)
        expect(yAxisOffset + maxValue).toBeGreaterThan(-100)
        expect(maxValue).toBeGreaterThan(0)
    })

    it('produces a valid range for all-negative variation', () => {
        const result = getChartYAxisRange(toPoints([-1000, -750, -500]))
        const { yAxisOffset, maxValue } = result
        expect(maxValue).toBeGreaterThan(0)
        expect(yAxisOffset).toBeLessThan(-1000)
        expect(yAxisOffset + maxValue).toBeGreaterThan(-500)
        expect(peakPosition(result, -500)).toBeCloseTo(11 / 12, 5)
    })

    it('produces a valid range for mixed-sign data spanning zero', () => {
        const result = getChartYAxisRange(toPoints([-200, 0, 800]))
        const { yAxisOffset, maxValue } = result
        expect(yAxisOffset).toBeLessThan(-200)
        expect(yAxisOffset + maxValue).toBeGreaterThan(800)
        expect(peakPosition(result, 800)).toBeCloseTo(11 / 12, 5)
    })

    it('treats a single data point as flat and returns a valid bracketing range', () => {
        const { yAxisOffset, maxValue } = getChartYAxisRange(toPoints([42]))
        expect(yAxisOffset).toBeLessThan(42)
        expect(yAxisOffset + maxValue).toBeGreaterThan(42)
        expect(maxValue).toBeGreaterThan(0)
    })
})
