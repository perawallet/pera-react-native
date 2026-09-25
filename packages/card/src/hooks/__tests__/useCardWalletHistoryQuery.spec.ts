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
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { Decimal } from 'decimal.js'

const mockUseNetwork = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mockUseNetwork,
}))

const { fetchWalletHistory } = vi.hoisted(() => ({
    fetchWalletHistory: vi.fn(),
}))
vi.mock('../../api/wallet-balance', () => ({ fetchWalletHistory }))

const mockSession = vi.hoisted(() => ({ isAuthenticated: true }))
vi.mock('../useCardSession', () => ({
    useCardSession: () => ({ isAuthenticated: mockSession.isAuthenticated }),
}))

import { useCardWalletHistoryQuery } from '../useCardWalletHistoryQuery'
import { CardWalletKind, TransactionSign } from '../../models'

const entry = (name: string) => ({
    name,
    amount: new Decimal('4.5'),
    currency: 'usdc',
    sign: TransactionSign.Credit,
    dateTime: '2026-09-10T09:15:00.000Z',
})

describe('useCardWalletHistoryQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        vi.clearAllMocks()
        mockUseNetwork.mockReturnValue({ network: 'mainnet' })
        mockSession.isAuthenticated = true
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it.each([CardWalletKind.Reward, CardWalletKind.Credit])(
        'loads the first page of %s history for the given wallet',
        async kind => {
            fetchWalletHistory.mockResolvedValue({
                items: [entry('a')],
                page: 0,
                hasMore: false,
            })

            const { result } = renderHook(
                () => useCardWalletHistoryQuery(kind, 'w_1'),
                { wrapper },
            )

            await waitFor(() => expect(result.current.entries).toHaveLength(1))
            expect(fetchWalletHistory).toHaveBeenCalledWith(
                expect.objectContaining({
                    kind,
                    walletId: 'w_1',
                    page: 0,
                    network: 'mainnet',
                }),
            )
            expect(result.current.hasNextPage).toBe(false)
        },
    )

    it('asks for the next page only while Baanx reports more', async () => {
        fetchWalletHistory
            .mockResolvedValueOnce({
                items: [entry('a')],
                page: 0,
                hasMore: true,
            })
            .mockResolvedValueOnce({
                items: [entry('b')],
                page: 1,
                hasMore: false,
            })

        const { result } = renderHook(
            () => useCardWalletHistoryQuery(CardWalletKind.Reward, 'w_1'),
            { wrapper },
        )

        await waitFor(() => expect(result.current.hasNextPage).toBe(true))
        result.current.fetchNextPage()

        await waitFor(() => expect(result.current.entries).toHaveLength(2))
        expect(fetchWalletHistory).toHaveBeenLastCalledWith(
            expect.objectContaining({ page: 1 }),
        )
        expect(result.current.hasNextPage).toBe(false)
    })

    // A wallet Baanx has not created yet has no id and no history; asking
    // would only produce a request that cannot succeed.
    it('stays idle without a wallet id', () => {
        renderHook(
            () => useCardWalletHistoryQuery(CardWalletKind.Credit, null),
            { wrapper },
        )

        expect(fetchWalletHistory).not.toHaveBeenCalled()
    })

    it('stays idle without a Baanx session', () => {
        mockSession.isAuthenticated = false

        renderHook(
            () => useCardWalletHistoryQuery(CardWalletKind.Reward, 'w_1'),
            { wrapper },
        )

        expect(fetchWalletHistory).not.toHaveBeenCalled()
    })
})
