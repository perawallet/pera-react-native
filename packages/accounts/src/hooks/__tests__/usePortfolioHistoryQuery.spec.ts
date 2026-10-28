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

import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { fetchPortfolioHistory } from '../../chain-adapter'
import { usePortfolioHistoryQuery } from '../usePortfolioHistoryQuery'

vi.mock('../../chain-adapter', async importOriginal => ({
    ...(await importOriginal<typeof import('../../chain-adapter')>()),
    fetchPortfolioHistory: vi.fn(),
}))

const chainsWithoutHistory = new Set<string>()
vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapabilityCheck:
        () =>
        ({ chain }: { chain: { chainId: string } }) =>
            !chainsWithoutHistory.has(chain.chainId),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({
        usdToPreferred: (amount: Decimal) => amount.mul(2),
    }),
}))

const ALGORAND: ChainScope = {
    chainId: 'algorand' as ChainId,
    networkId: 'mainnet',
}
const ETHEREUM: ChainScope = {
    chainId: 'ethereum' as ChainId,
    networkId: 'mainnet',
}

const history = vi.mocked(fetchPortfolioHistory)

const point = (timestamp: number, usd: string) => ({
    timestamp,
    usdValue: new Decimal(usd),
    nativeValue: new Decimal(1),
})

const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
        QueryClientProvider,
        {
            client: new QueryClient({
                defaultOptions: { queries: { retry: false } },
            }),
        },
        children,
    )

describe('usePortfolioHistoryQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        chainsWithoutHistory.clear()
    })

    it("sums each chain's history and converts it to the preferred currency", async () => {
        history.mockImplementation(async (_addresses, _period, scope) =>
            scope.chainId === ALGORAND.chainId
                ? [point(1, '10'), point(2, '20')]
                : [point(1, '100'), point(2, '200')],
        )
        const sources = [
            { address: 'ALGO', scope: ALGORAND },
            { address: '0xeth', scope: ETHEREUM },
        ]

        const { result } = renderHook(
            () => usePortfolioHistoryQuery(sources, 'one-week', ALGORAND),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(history).toHaveBeenCalledTimes(2)
        expect(history).toHaveBeenCalledWith(['ALGO'], 'one-week', ALGORAND)
        expect(history).toHaveBeenCalledWith(['0xeth'], 'one-week', ETHEREUM)
        expect(result.current.data).toEqual([
            { datetime: new Date(1), preferredValue: new Decimal(220) },
            { datetime: new Date(2), preferredValue: new Decimal(440) },
        ])
    })

    it('fetches sources on one scope in a single request', async () => {
        history.mockResolvedValue([])
        const sources = [
            { address: 'A', scope: ALGORAND },
            { address: 'B', scope: ALGORAND },
        ]

        const { result } = renderHook(
            () => usePortfolioHistoryQuery(sources, 'one-day', ALGORAND),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(history).toHaveBeenCalledTimes(1)
        expect(history).toHaveBeenCalledWith(['A', 'B'], 'one-day', ALGORAND)
        expect(result.current.data).toEqual([])
    })

    it("is unavailable, without a request, when a source's chain has no history", () => {
        chainsWithoutHistory.add(ETHEREUM.chainId)
        const sources = [
            { address: 'ALGO', scope: ALGORAND },
            { address: '0xeth', scope: ETHEREUM },
        ]

        const { result } = renderHook(
            () => usePortfolioHistoryQuery(sources, 'one-day', ALGORAND),
            { wrapper },
        )

        expect(result.current.isUnavailableOnNetwork).toBe(true)
        expect(result.current.isPending).toBe(false)
        expect(history).not.toHaveBeenCalled()
    })

    it("is unavailable, not a partial chart, when a chain's network serves no history", async () => {
        history.mockImplementation(async (_addresses, _period, scope) =>
            scope.chainId === ETHEREUM.chainId ? null : [point(1, '10')],
        )
        const sources = [
            { address: 'ALGO', scope: ALGORAND },
            { address: '0xeth', scope: ETHEREUM },
        ]

        const { result } = renderHook(
            () => usePortfolioHistoryQuery(sources, 'one-day', ALGORAND),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.isUnavailableOnNetwork).toBe(true),
        )
        expect(result.current.isPending).toBe(false)
        expect(result.current.data).toEqual([])
    })

    it('charts nothing while one chain has points and another has none', async () => {
        history.mockImplementation(async (_addresses, _period, scope) =>
            scope.chainId === ETHEREUM.chainId ? [] : [point(1, '10')],
        )
        const sources = [
            { address: 'ALGO', scope: ALGORAND },
            { address: '0xeth', scope: ETHEREUM },
        ]

        const { result } = renderHook(
            () => usePortfolioHistoryQuery(sources, 'one-day', ALGORAND),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(history).toHaveBeenCalledTimes(2)
        expect(result.current.isUnavailableOnNetwork).toBe(false)
        expect(result.current.data).toEqual([])
    })

    it("reports an error when one chain's history fails", async () => {
        history.mockImplementation(async (_addresses, _period, scope) => {
            if (scope.chainId === ETHEREUM.chainId) {
                throw new Error('history down')
            }
            return [point(1, '10')]
        })
        const sources = [
            { address: 'ALGO', scope: ALGORAND },
            { address: '0xeth', scope: ETHEREUM },
        ]

        const { result } = renderHook(
            () => usePortfolioHistoryQuery(sources, 'one-day', ALGORAND),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toEqual(new Error('history down'))
    })

    it('does not fetch while disabled', () => {
        const { result } = renderHook(
            () =>
                usePortfolioHistoryQuery(
                    [{ address: 'ALGO', scope: ALGORAND }],
                    'one-day',
                    ALGORAND,
                    false,
                ),
            { wrapper },
        )

        expect(history).not.toHaveBeenCalled()
        expect(result.current.data).toEqual([])
    })

    it('is settled and empty with no sources', () => {
        const { result } = renderHook(
            () => usePortfolioHistoryQuery([], 'one-day', ALGORAND),
            { wrapper },
        )

        expect(result.current.isPending).toBe(false)
        expect(result.current.data).toEqual([])
        expect(history).not.toHaveBeenCalled()
    })
})
