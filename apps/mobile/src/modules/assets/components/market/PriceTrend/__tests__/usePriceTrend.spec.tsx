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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useAssetPriceHistoryQuery } from '@perawallet/wallet-core-assets'
import { usePriceTrend } from '../usePriceTrend'

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useAssetPriceHistoryQuery: vi.fn(),
    }
})

const point = (usdPrice: number) => ({
    datetime: new Date('2026-07-01'),
    usdPrice: new Decimal(usdPrice),
})

const mockQuery = (
    data: ReturnType<typeof point>[] | undefined,
    isPaused: boolean,
) => {
    vi.mocked(useAssetPriceHistoryQuery).mockReturnValue({
        data,
        isPaused,
    } as unknown as ReturnType<typeof useAssetPriceHistoryQuery>)
}

describe('usePriceTrend', () => {
    beforeEach(() => {
        vi.mocked(useAssetPriceHistoryQuery).mockReset()
    })

    it('computes the percent and absolute change across the series', () => {
        mockQuery([point(100), point(150)], false)

        const { result } = renderHook(() =>
            usePriceTrend({ assetId: '123', period: 'one-week' }),
        )

        expect(result.current.changePercentage.toNumber()).toBe(50)
        expect(result.current.changeValue.toNumber()).toBe(50)
        expect(result.current.isPositive).toBe(true)
        expect(result.current.isHidden).toBe(false)
    })

    it('uses the selected data point as the trend endpoint', () => {
        mockQuery([point(100), point(150)], false)

        const { result } = renderHook(() =>
            usePriceTrend({
                assetId: '123',
                period: 'one-week',
                selectedDataPoint: point(80),
            }),
        )

        expect(result.current.changePercentage.toNumber()).toBe(-20)
        expect(result.current.isPositive).toBe(false)
    })

    it('hides the trend when offline-paused with no data', () => {
        mockQuery(undefined, true)

        const { result } = renderHook(() =>
            usePriceTrend({ assetId: '123', period: 'one-week' }),
        )

        expect(result.current.isHidden).toBe(true)
    })

    it('keeps showing the last-known trend when paused with stale data', () => {
        mockQuery([point(100), point(150)], true)

        const { result } = renderHook(() =>
            usePriceTrend({ assetId: '123', period: 'one-week' }),
        )

        expect(result.current.isHidden).toBe(false)
        expect(result.current.changePercentage.toNumber()).toBe(50)
    })

    it('does not hide the trend during an online load', () => {
        mockQuery(undefined, false)

        const { result } = renderHook(() =>
            usePriceTrend({ assetId: '123', period: 'one-week' }),
        )

        expect(result.current.isHidden).toBe(false)
        expect(result.current.changePercentage.toNumber()).toBe(0)
    })
})
