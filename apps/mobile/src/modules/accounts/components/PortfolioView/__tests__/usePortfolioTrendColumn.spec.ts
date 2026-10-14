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

import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePortfolioTrendColumn } from '../usePortfolioTrendColumn'

describe('usePortfolioTrendColumn', () => {
    it('keeps the column out of the layout when the chart starts hidden', () => {
        const { result } = renderHook(() => usePortfolioTrendColumn(false))

        expect(result.current.isTrendColumnInLayout).toBe(false)
    })

    it('keeps the column in the layout when the chart starts shown', () => {
        const { result } = renderHook(() => usePortfolioTrendColumn(true))

        expect(result.current.isTrendColumnInLayout).toBe(true)
    })

    it('holds the column in the layout until the fade-out completes', () => {
        const { result, rerender } = renderHook(
            ({ isChartShown }) => usePortfolioTrendColumn(isChartShown),
            { initialProps: { isChartShown: true } },
        )

        rerender({ isChartShown: false })
        expect(result.current.isTrendColumnInLayout).toBe(true)

        act(() => result.current.handleTrendFadeOutEnd())
        expect(result.current.isTrendColumnInLayout).toBe(false)
    })

    it('returns the column to the layout as soon as the chart is shown again', () => {
        const { result, rerender } = renderHook(
            ({ isChartShown }) => usePortfolioTrendColumn(isChartShown),
            { initialProps: { isChartShown: false } },
        )

        rerender({ isChartShown: true })
        expect(result.current.isTrendColumnInLayout).toBe(true)

        rerender({ isChartShown: false })
        expect(result.current.isTrendColumnInLayout).toBe(true)
    })
})
