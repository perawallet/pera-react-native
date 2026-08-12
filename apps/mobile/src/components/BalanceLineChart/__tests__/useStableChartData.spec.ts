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

import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useStableChartData } from '../useStableChartData'

type Item = { balance: number }

const getValue = (item: Item) => item.balance

describe('useStableChartData', () => {
    it('maps the series through getValue into indexed points', () => {
        const { result } = renderHook(() =>
            useStableChartData([{ balance: 5 }, { balance: 7 }], getValue),
        )

        expect(result.current).toEqual([
            { index: 0, value: 5 },
            { index: 1, value: 7 },
        ])
    })

    // victory resets an in-progress scrub from a useEffect keyed on the data
    // prop's identity, and the history queries hand us an equal-but-new array
    // on every refetch. Same numbers must mean the same reference.
    it('keeps the same reference when a refetch returns equal values', () => {
        const { result, rerender } = renderHook(
            ({ series }: { series: Item[] }) =>
                useStableChartData(series, getValue),
            { initialProps: { series: [{ balance: 5 }, { balance: 7 }] } },
        )

        const first = result.current
        rerender({ series: [{ balance: 5 }, { balance: 7 }] })

        expect(result.current).toBe(first)
    })

    it('returns a new reference when a value actually changes', () => {
        const { result, rerender } = renderHook(
            ({ series }: { series: Item[] }) =>
                useStableChartData(series, getValue),
            { initialProps: { series: [{ balance: 5 }, { balance: 7 }] } },
        )

        const first = result.current
        rerender({ series: [{ balance: 5 }, { balance: 8 }] })

        expect(result.current).not.toBe(first)
        expect(result.current.at(-1)?.value).toBe(8)
    })

    it('returns a new reference when the series length changes', () => {
        const { result, rerender } = renderHook(
            ({ series }: { series: Item[] }) =>
                useStableChartData(series, getValue),
            { initialProps: { series: [{ balance: 5 }] } },
        )

        const first = result.current
        rerender({ series: [{ balance: 5 }, { balance: 7 }] })

        expect(result.current).not.toBe(first)
        expect(result.current).toHaveLength(2)
    })

    it('treats an undefined series as empty and keeps it stable', () => {
        const { result, rerender } = renderHook(
            ({ series }: { series: Item[] | undefined }) =>
                useStableChartData(series, getValue),
            { initialProps: { series: undefined as Item[] | undefined } },
        )

        const first = result.current
        expect(first).toEqual([])

        rerender({ series: undefined })
        expect(result.current).toBe(first)
    })
})
