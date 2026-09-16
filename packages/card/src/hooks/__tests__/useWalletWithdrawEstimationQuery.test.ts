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

const { fetchWalletWithdrawEstimation } = vi.hoisted(() => ({
    fetchWalletWithdrawEstimation: vi.fn(),
}))
vi.mock('../../api/wallet-balance', () => ({ fetchWalletWithdrawEstimation }))

const mockSession = vi.hoisted(() => ({ isAuthenticated: true }))
vi.mock('../useCardSession', () => ({
    useCardSession: () => ({ isAuthenticated: mockSession.isAuthenticated }),
}))

import { useWalletWithdrawEstimationQuery } from '../useWalletWithdrawEstimationQuery'
import { CardWalletKind } from '../../models'

describe('useWalletWithdrawEstimationQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        vi.clearAllMocks()
        mockUseNetwork.mockReturnValue({ network: 'mainnet' })
        mockSession.isAuthenticated = true
        fetchWalletWithdrawEstimation.mockResolvedValue({
            fee: new Decimal('0.000006219'),
            gas: '6219',
        })
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it.each([CardWalletKind.Reward, CardWalletKind.Credit])(
        'quotes the %s wallet when enabled',
        async kind => {
            const { result } = renderHook(
                () => useWalletWithdrawEstimationQuery(kind, true),
                { wrapper },
            )

            await waitFor(() =>
                expect(result.current.estimation).not.toBeNull(),
            )
            expect(result.current.estimation?.fee.toString()).toBe(
                '0.000006219',
            )
            expect(fetchWalletWithdrawEstimation).toHaveBeenCalledWith(
                expect.objectContaining({ kind, network: 'mainnet' }),
            )
        },
    )

    // The quote belongs to the confirm step only; fetching it earlier would
    // hand the user a stale fee by the time they see it.
    it('does not fetch while disabled', () => {
        renderHook(
            () =>
                useWalletWithdrawEstimationQuery(CardWalletKind.Reward, false),
            { wrapper },
        )

        expect(fetchWalletWithdrawEstimation).not.toHaveBeenCalled()
    })

    it('does not fetch without a Baanx session', () => {
        mockSession.isAuthenticated = false

        renderHook(
            () => useWalletWithdrawEstimationQuery(CardWalletKind.Reward, true),
            { wrapper },
        )

        expect(fetchWalletWithdrawEstimation).not.toHaveBeenCalled()
    })
})
