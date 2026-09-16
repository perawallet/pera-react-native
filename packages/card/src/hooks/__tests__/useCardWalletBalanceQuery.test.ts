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

const { fetchWalletBalance } = vi.hoisted(() => ({
    fetchWalletBalance: vi.fn(),
}))
vi.mock('../../api/wallet-balance', () => ({ fetchWalletBalance }))

const mockSession = vi.hoisted(() => ({ isAuthenticated: true }))
vi.mock('../useCardSession', () => ({
    useCardSession: () => ({ isAuthenticated: mockSession.isAuthenticated }),
}))

import { useCardWalletBalanceQuery } from '../useCardWalletBalanceQuery'
import { CardWalletKind } from '../../models'

const wallet = (id: string, balance: string) => ({
    id,
    balance: new Decimal(balance),
    currency: 'usdc',
    isWithdrawable: true,
})

describe('useCardWalletBalanceQuery', () => {
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
        'returns the %s wallet once loaded, fetched for that kind',
        async kind => {
            fetchWalletBalance.mockResolvedValue(wallet('w_1', '12.34'))

            const { result } = renderHook(
                () => useCardWalletBalanceQuery(kind),
                { wrapper },
            )

            await waitFor(() => expect(result.current.wallet).not.toBeNull())
            expect(result.current.wallet?.balance.toFixed(2)).toBe('12.34')
            expect(fetchWalletBalance).toHaveBeenCalledWith(
                expect.objectContaining({ kind, network: 'mainnet' }),
            )
        },
    )

    // The two wallets live under separate query keys, or a reward fetch would
    // be served from the credit cache and vice versa.
    it('keeps the reward and credit wallets in separate cache entries', async () => {
        fetchWalletBalance
            .mockResolvedValueOnce(wallet('reward_1', '5'))
            .mockResolvedValueOnce(wallet('credit_1', '9'))

        const { result } = renderHook(
            () => ({
                reward: useCardWalletBalanceQuery(CardWalletKind.Reward),
                credit: useCardWalletBalanceQuery(CardWalletKind.Credit),
            }),
            { wrapper },
        )

        await waitFor(() => {
            expect(result.current.reward.wallet).not.toBeNull()
            expect(result.current.credit.wallet).not.toBeNull()
        })
        expect(fetchWalletBalance).toHaveBeenCalledTimes(2)
        expect(result.current.reward.wallet?.balance.toFixed()).toBe('5')
        expect(result.current.credit.wallet?.balance.toFixed()).toBe('9')
    })

    it('stays idle without a Baanx session', () => {
        mockSession.isAuthenticated = false

        renderHook(() => useCardWalletBalanceQuery(CardWalletKind.Reward), {
            wrapper,
        })

        expect(fetchWalletBalance).not.toHaveBeenCalled()
    })
})
