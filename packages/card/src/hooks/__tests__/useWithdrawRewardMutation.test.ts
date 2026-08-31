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

const mockUseNetwork = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mockUseNetwork,
}))

const { withdrawReward } = vi.hoisted(() => ({ withdrawReward: vi.fn() }))
vi.mock('../../api/reward', () => ({ withdrawReward }))

import { useWithdrawRewardMutation } from '../useWithdrawRewardMutation'
import { cardQueryKeys } from '../querykeys'

describe('useWithdrawRewardMutation', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })
        vi.clearAllMocks()
        mockUseNetwork.mockReturnValue({ network: 'mainnet' })
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it('withdraws and invalidates the reward wallet query', async () => {
        withdrawReward.mockResolvedValue({
            txHash: '0xabc',
            network: 'linea',
            isConfirmed: true,
        })
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(() => useWithdrawRewardMutation(), {
            wrapper,
        })
        result.current.mutate({ amount: '10.5' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(withdrawReward).toHaveBeenCalledWith({
            amount: '10.5',
            network: 'mainnet',
        })
        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: cardQueryKeys.rewardWallet('mainnet'),
        })
        expect(result.current.data?.txHash).toBe('0xabc')
    })

    it('surfaces a withdraw failure', async () => {
        withdrawReward.mockRejectedValue(new Error('nope'))

        const { result } = renderHook(() => useWithdrawRewardMutation(), {
            wrapper,
        })
        result.current.mutate({ amount: '1' })

        await waitFor(() => expect(result.current.isError).toBe(true))
    })
})
