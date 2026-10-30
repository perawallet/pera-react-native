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
import type { HistoryPeriod } from '@perawallet/wallet-core-shared'
import { usePortfolioChange } from '../usePortfolioChange'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    usePortfolioHistoryQuery: vi.fn(),
}))

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const SOURCES: AccountHoldingSource[] = [{ address: 'ALGO', scope: SCOPE }]

const point = (preferredValue: string) => ({
    datetime: new Date(0),
    preferredValue: new Decimal(preferredValue),
})

const mockHistory = (
    overrides: Partial<ReturnType<typeof usePortfolioHistoryQuery>> = {},
) =>
    vi.mocked(usePortfolioHistoryQuery).mockReturnValue({
        data: [point('100'), point('120')],
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

type Params = {
    chartPeriod: HistoryPeriod
    isChartShown: boolean
    isEnabled: boolean
}

const renderChange = (params: Params) =>
    renderHook(
        (props: Params) =>
            usePortfolioChange({
                chartSources: SOURCES,
                scope: SCOPE,
                ...props,
            }),
        { initialProps: params },
    )

const lastQuery = () => vi.mocked(usePortfolioHistoryQuery).mock.lastCall

describe('usePortfolioChange', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockHistory()
    })

    it('measures the last 24 hours while the chart is collapsed, whatever period the chart holds', () => {
        const { result } = renderChange({
            chartPeriod: 'one-year',
            isChartShown: false,
            isEnabled: true,
        })

        expect(result.current.changePeriod).toBe('one-day')
        expect(lastQuery()?.[1]).toBe('one-day')
        expect(result.current.changeAbsolute).toEqual(new Decimal(20))
        expect(result.current.changePercentage.toNumber()).toBeCloseTo(20)
        expect(result.current.hasChange).toBe(true)
    })

    it("follows the chart's period while it is expanded, and tracks a period change", () => {
        const { result, rerender } = renderChange({
            chartPeriod: 'one-week',
            isChartShown: true,
            isEnabled: true,
        })
        expect(result.current.changePeriod).toBe('one-week')
        expect(lastQuery()?.[1]).toBe('one-week')

        rerender({
            chartPeriod: 'one-month',
            isChartShown: true,
            isEnabled: true,
        })

        expect(result.current.changePeriod).toBe('one-month')
        expect(lastQuery()?.[1]).toBe('one-month')
    })

    it('does not fetch when the card cannot show a change', () => {
        const { result } = renderChange({
            chartPeriod: 'one-week',
            isChartShown: false,
            isEnabled: false,
        })

        expect(lastQuery()?.[3]).toBe(false)
        expect(result.current.hasChange).toBe(false)
    })

    it('keeps the last settled change on screen while the next period loads', () => {
        const { result, rerender } = renderChange({
            chartPeriod: 'one-week',
            isChartShown: true,
            isEnabled: true,
        })
        expect(result.current.hasChange).toBe(true)

        mockHistory({ isPending: true, data: [] })
        rerender({
            chartPeriod: 'one-month',
            isChartShown: true,
            isEnabled: true,
        })

        expect(result.current.hasChange).toBe(true)
        expect(result.current.changeAbsolute).toEqual(new Decimal(20))
        expect(result.current.changePeriod).toBe('one-month')
    })

    it('drops the held change once the card can no longer show one', () => {
        const { result, rerender } = renderChange({
            chartPeriod: 'one-week',
            isChartShown: true,
            isEnabled: true,
        })

        mockHistory({ isPending: true, data: [] })
        rerender({
            chartPeriod: 'one-week',
            isChartShown: true,
            isEnabled: false,
        })
        rerender({
            chartPeriod: 'one-month',
            isChartShown: true,
            isEnabled: true,
        })

        expect(result.current.hasChange).toBe(false)
    })

    it('drops the held change when the new period settles without one', () => {
        const { result, rerender } = renderChange({
            chartPeriod: 'one-week',
            isChartShown: true,
            isEnabled: true,
        })

        mockHistory({ isPartial: true })
        rerender({
            chartPeriod: 'one-month',
            isChartShown: true,
            isEnabled: true,
        })
        mockHistory({ isPending: true, data: [] })
        rerender({
            chartPeriod: 'one-year',
            isChartShown: true,
            isEnabled: true,
        })

        expect(result.current.hasChange).toBe(false)
    })

    it('has no change while the history is loading', () => {
        mockHistory({ isPending: true, data: [] })

        const { result } = renderChange({
            chartPeriod: 'one-week',
            isChartShown: false,
            isEnabled: true,
        })

        expect(result.current.hasChange).toBe(false)
    })

    it('has no change when a chain is left out of the history', () => {
        mockHistory({ isPartial: true })

        const { result } = renderChange({
            chartPeriod: 'one-week',
            isChartShown: false,
            isEnabled: true,
        })

        expect(result.current.hasChange).toBe(false)
    })
})
