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
import {
    holdingPriceChange,
    useHistoryTrend,
    usePortfolioTrend,
} from '../usePortfolioTrend'

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
        isRetrying: false,
        isPaused: false,
        error: null,
        isUnavailableOnNetwork: false,
        excludedChainIds: [],
        failedChainIds: [],
        isRetryingFailed: false,
        isPartial: false,
        refetch: vi.fn(),
        refetchFailed: vi.fn(),
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

    it('measures from the chart start to a scrubbed point rather than the latest', () => {
        mockHistory({ data: [point('100'), point('150'), point('120')] })

        const { result } = renderHook(() =>
            usePortfolioTrend(
                SOURCES,
                'one-day',
                SCOPE,
                true,
                new Decimal(150),
            ),
        )

        expect(result.current.trendAbsolute).toEqual(new Decimal(50))
        expect(result.current.trendPercentage).toEqual(new Decimal(50))
        expect(result.current.hasNoTrend).toBe(false)
    })

    it('has no trend at a scrubbed point with no price', () => {
        mockHistory({ data: [point('100'), point('120')] })

        const { result } = renderHook(() =>
            usePortfolioTrend(SOURCES, 'one-day', SCOPE, true, null),
        )

        expect(result.current.hasNoTrend).toBe(true)
    })

    it('reads a move under a cent as flat, since the line renders at 2 dp', () => {
        mockHistory({ data: [point('100'), point('100.003')] })

        expect(renderTrend().result.current.trendDirection).toBe('flat')
    })

    it('has no trend once settled without a priced point', () => {
        mockHistory({ data: [point(null)] })

        expect(renderTrend().result.current.hasNoTrend).toBe(true)
    })

    it('reads a loaded history with no points as a flat zero', () => {
        mockHistory({ data: [] })

        const { result } = renderTrend()

        expect(result.current.hasNoTrend).toBe(false)
        expect(result.current.trendDirection).toBe('flat')
        expect(result.current.trendAbsolute).toEqual(new Decimal(0))
    })

    it('has no trend when the history read failed', () => {
        mockHistory({ data: [], isError: true })

        expect(renderTrend().result.current.hasNoTrend).toBe(true)
    })

    it('has no trend when the network has no history to read', () => {
        mockHistory({ data: [], isUnavailableOnNetwork: true })

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

describe('useHistoryTrend for an amount', () => {
    const amountPoint = (amount: string) => ({
        datetime: new Date(0),
        preferredValue: null,
        amount: new Decimal(amount),
    })
    const renderAmountTrend = (amounts: string[], selectedAmount?: Decimal) =>
        renderHook(() =>
            useHistoryTrend(
                {
                    data: amounts.map(amountPoint),
                    isPending: false,
                    isPaused: false,
                    isError: false,
                },
                false,
                selectedAmount,
                'amount',
            ),
        )

    it('measures the amount held, unpriced points included', () => {
        const { result } = renderAmountTrend(['2', '2.5'])

        expect(result.current.hasNoTrend).toBe(false)
        expect(result.current.trendAbsolute.toFixed()).toBe('0.5')
        expect(result.current.trendPercentage.toFixed()).toBe('25')
        expect(result.current.trendDirection).toBe('up')
    })

    it('reads a move under a cent but over the 4th place as a change, since the amount renders at 4 dp', () => {
        const { result } = renderAmountTrend(['1', '1.001'])

        expect(result.current.trendDirection).toBe('up')
    })

    it('measures to a scrubbed amount', () => {
        const { result } = renderAmountTrend(['2', '4'], new Decimal('1'))

        expect(result.current.trendAbsolute.toFixed()).toBe('-1')
        expect(result.current.trendDirection).toBe('down')
    })
})

describe('holdingPriceChange', () => {
    const held = (amount: string, preferredValue: string) => ({
        amount: new Decimal(amount),
        preferredValue: new Decimal(preferredValue),
    })

    it('measures the price move of an amount held throughout', () => {
        const { change, percentage } = holdingPriceChange([
            held('2', '200'),
            held('2', '250'),
        ])

        expect(change.toFixed()).toBe('50')
        expect(percentage.toFixed()).toBe('25')
    })

    it('leaves a receive out, earning only on what was held before each step', () => {
        const { change, percentage } = holdingPriceChange([
            held('1', '100'),
            held('3', '330'),
            held('3', '360'),
        ])

        // 1 × (110 − 100) + 3 × (120 − 110)
        expect(change.toFixed()).toBe('40')
        expect(percentage.toFixed()).toBe('20')
    })

    it('reads a holding received at the last point as no change', () => {
        const { change, percentage } = holdingPriceChange([
            held('0', '0'),
            held('0', '0'),
            held('0.0153', '2.15'),
        ])

        expect(change.isZero()).toBe(true)
        expect(percentage.isZero()).toBe(true)
    })

    it('keeps the previous price for a step that ends with nothing held', () => {
        const { change } = holdingPriceChange([
            held('2', '200'),
            held('2', '220'),
            held('0', '0'),
        ])

        expect(change.toFixed()).toBe('20')
    })

    it('reads a held point with a zero value as an unknown price, not a total loss', () => {
        const { change, percentage } = holdingPriceChange([
            held('1', '100'),
            held('1', '0'),
            held('1', '120'),
        ])

        expect(change.toFixed()).toBe('20')
        expect(percentage.toFixed()).toBe('20')
    })

    it('compounds only the steps something was held through', () => {
        const { percentage } = holdingPriceChange([
            held('1', '100'),
            held('1', '110'),
            held('0', '0'),
            held('1', '200'),
            held('1', '220'),
        ])

        // 1.1 × 1.1: the gap from 110 to 200 held nothing.
        expect(percentage.toFixed()).toBe('21')
    })
})

describe('useHistoryTrend for a holding value', () => {
    const at = (minute: number) => new Date(minute * 60_000)
    const history = {
        data: [
            {
                datetime: at(0),
                amount: new Decimal(1),
                preferredValue: new Decimal(100),
            },
            {
                datetime: at(1),
                amount: new Decimal(1),
                preferredValue: new Decimal(150),
            },
            {
                datetime: at(2),
                amount: new Decimal(1),
                preferredValue: new Decimal(120),
            },
        ],
        isPending: false,
        isPaused: false,
        isError: false,
    }

    it('runs to the scrubbed point by its time', () => {
        const { result } = renderHook(() =>
            useHistoryTrend(
                history,
                false,
                new Decimal(150),
                'holding-value',
                at(1),
            ),
        )

        expect(result.current.trendAbsolute.toFixed()).toBe('50')
        expect(result.current.trendDirection).toBe('up')
    })

    it('runs to the last point with nothing scrubbed', () => {
        const { result } = renderHook(() =>
            useHistoryTrend(history, false, undefined, 'holding-value'),
        )

        expect(result.current.trendAbsolute.toFixed()).toBe('20')
    })
})
