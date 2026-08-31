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

const { fetchRewardWallet } = vi.hoisted(() => ({
    fetchRewardWallet: vi.fn(),
}))
vi.mock('../../api/reward', () => ({ fetchRewardWallet }))

const mockSession = vi.hoisted(() => ({ isAuthenticated: true }))
vi.mock('../useCardSession', () => ({
    useCardSession: () => ({ isAuthenticated: mockSession.isAuthenticated }),
}))

import { useCardRewardWalletQuery } from '../useCardRewardWalletQuery'

describe('useCardRewardWalletQuery', () => {
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

    it('returns the reward wallet once loaded', async () => {
        fetchRewardWallet.mockResolvedValue({
            id: 'rw_1',
            balance: new Decimal('12.34'),
            currency: 'usdc',
            isWithdrawable: true,
        })

        const { result } = renderHook(() => useCardRewardWalletQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.rewardWallet).not.toBeNull())
        expect(result.current.rewardWallet?.balance.toFixed(2)).toBe('12.34')
    })

    it('stays idle without a Baanx session', () => {
        mockSession.isAuthenticated = false

        renderHook(() => useCardRewardWalletQuery(), { wrapper })

        expect(fetchRewardWallet).not.toHaveBeenCalled()
    })
})
