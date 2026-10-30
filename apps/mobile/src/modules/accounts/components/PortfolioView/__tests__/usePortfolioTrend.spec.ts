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
    renderHook(() => usePortfolioTrend(SOURCES, 'one-week', SCOPE, true))

describe('usePortfolioTrend', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('measures the change from the first to the last priced point', () => {
        mockHistory({ data: [point('100'), point(null), point('120')] })

        const { result } = renderTrend()

        expect(result.current.trendAbsolute).toEqual(new Decimal(20))
        expect(result.current.trendPercentage).toEqual(new Decimal(20))
        expect(result.current.hasNoTrend).toBe(false)
        expect(usePortfolioHistoryQuery).toHaveBeenLastCalledWith(
            SOURCES,
            'one-week',
            SCOPE,
            true,
        )
    })

    it('has no trend once settled without a priced point', () => {
        mockHistory({ data: [point(null)] })

        expect(renderTrend().result.current.hasNoTrend).toBe(true)
    })

    it('keeps the trend slot while the history is still loading', () => {
        mockHistory({ isPending: true })

        const { result } = renderTrend()

        expect(result.current.hasNoTrend).toBe(false)
        expect(result.current.isPending).toBe(true)
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
