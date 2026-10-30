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
import {
    usePortfolioHistoryQuery,
    type AccountHoldingSource,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { usePortfolioTrend } from '../usePortfolioTrend'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    usePortfolioHistoryQuery: vi.fn(),
}))

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const SOURCES: AccountHoldingSource[] = [{ address: 'ALGO', scope: SCOPE }]

const point = (preferredValue: string | null) => ({
    datetime: new Date(0),
    preferredValue:
        preferredValue === null ? null : new Decimal(preferredValue),
})

const mockHistory = (
    overrides: Partial<ReturnType<typeof usePortfolioHistoryQuery>>,
) =>
    vi.mocked(usePortfolioHistoryQuery).mockReturnValue({
        data: [],
        isPending: false,
        isError: false,
        isPaused: false,
        error: null,
        isUnavailableOnNetwork: false,
        excludedChainIds: [],
        isPartial: false,
        refetch: vi.fn(),
        ...overrides,
    })

const renderTrend = () =>
    renderHook(() => usePortfolioTrend(SOURCES, 'one-day', SCOPE, true))

describe('usePortfolioTrend', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('measures a gain from the first to the last priced point', () => {
        mockHistory({ data: [point('100'), point(null), point('120')] })

        const { result } = renderTrend()

        expect(result.current.trendAbsolute).toEqual(new Decimal(20))
        expect(result.current.trendPercentage).toEqual(new Decimal(20))
        expect(result.current.trendDirection).toBe('up')
        expect(result.current.hasNoTrend).toBe(false)
        expect(usePortfolioHistoryQuery).toHaveBeenLastCalledWith(
            SOURCES,
            'one-day',
            SCOPE,
            true,
        )
    })

    it('measures a loss', () => {
        mockHistory({ data: [point('120'), point('90')] })

        const { result } = renderTrend()

        expect(result.current.trendAbsolute).toEqual(new Decimal(-30))
        expect(result.current.trendPercentage).toEqual(new Decimal(-25))
        expect(result.current.trendDirection).toBe('down')
    })

    it('reads an unchanged value as flat', () => {
        mockHistory({ data: [point('100'), point('100')] })

        const { result } = renderTrend()

        expect(result.current.trendDirection).toBe('flat')
        expect(result.current.hasNoTrend).toBe(false)
    })

    it('reads a move under a cent as flat, since the line renders at 2 dp', () => {
        mockHistory({ data: [point('100'), point('100.003')] })

        expect(renderTrend().result.current.trendDirection).toBe('flat')
    })

    it('has no trend once settled without a priced point', () => {
        mockHistory({ data: [point(null)] })

        expect(renderTrend().result.current.hasNoTrend).toBe(true)
    })

    it('has no trend once settled with no history at all', () => {
        mockHistory({ data: [] })

        expect(renderTrend().result.current.hasNoTrend).toBe(true)
    })

    it('keeps the trend slot while the history is still loading', () => {
        mockHistory({ isPending: true })

        const { result } = renderTrend()

        expect(result.current.isPending).toBe(true)
        expect(result.current.hasNoTrend).toBe(false)
    })

    it('has no trend when an offline read will not resolve', () => {
        mockHistory({ isPending: true, isPaused: true })

        const { result } = renderTrend()

        expect(result.current.isPending).toBe(false)
        expect(result.current.hasNoTrend).toBe(true)
    })

    it('has no trend while the chart leaves a chain out of the total', () => {
        mockHistory({
            data: [point('100'), point('120')],
            excludedChainIds: ['ethereum'],
            isPartial: true,
        })

        expect(renderTrend().result.current.hasNoTrend).toBe(true)
    })
})
