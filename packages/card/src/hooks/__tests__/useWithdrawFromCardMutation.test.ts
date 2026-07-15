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

const { withdrawFromCard } = vi.hoisted(() => ({ withdrawFromCard: vi.fn() }))
vi.mock('../../api/wallet', () => ({ withdrawFromCard }))

import { useWithdrawFromCardMutation } from '../useWithdrawFromCardMutation'
import { cardQueryKeys } from '../querykeys'
import type { CardInternalWallet } from '../../models'

const usdcWallet: CardInternalWallet = {
    id: 'wallet_usdc',
    balance: new Decimal('125.50'),
    currency: 'usdc',
    address: 'BAANX_ADDR',
    addressMemo: 's-memo',
    addressId: 'addr_1',
    type: 'INTERNAL',
}

describe('useWithdrawFromCardMutation', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
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

    it('withdraws the amount as a decimal string with the wallet source fields', async () => {
        withdrawFromCard.mockResolvedValue(undefined)

        const { result } = renderHook(() => useWithdrawFromCardMutation(), {
            wrapper,
        })

        await result.current.mutateAsync({
            amount: new Decimal('25.5'),
            recipientAddress: 'ALGO_RECIPIENT',
            wallet: usdcWallet,
        })

        expect(withdrawFromCard).toHaveBeenCalledWith({
            network: 'mainnet',
            amount: '25.5',
            recipientAddress: 'ALGO_RECIPIENT',
            sourceAddress: 'BAANX_ADDR',
            sourceMemo: 's-memo',
            currency: 'usdc',
        })
    })

    it('omits the source memo when the wallet has none', async () => {
        withdrawFromCard.mockResolvedValue(undefined)

        const { result } = renderHook(() => useWithdrawFromCardMutation(), {
            wrapper,
        })

        await result.current.mutateAsync({
            amount: new Decimal(1),
            recipientAddress: 'ALGO_RECIPIENT',
            wallet: { ...usdcWallet, addressMemo: null },
        })

        expect(withdrawFromCard).toHaveBeenCalledWith(
            expect.objectContaining({ sourceMemo: undefined }),
        )
    })

    it('invalidates the internal wallets and transactions queries on success', async () => {
        withdrawFromCard.mockResolvedValue(undefined)
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(() => useWithdrawFromCardMutation(), {
            wrapper,
        })

        await result.current.mutateAsync({
            amount: new Decimal(1),
            recipientAddress: 'ALGO_RECIPIENT',
            wallet: usdcWallet,
        })

        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: cardQueryKeys.internalWallets('mainnet'),
        })
        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: ['card', 'transactions'],
        })
    })

    it('surfaces endpoint failures via isError', async () => {
        withdrawFromCard.mockRejectedValue(new Error('Insufficient balance'))

        const { result } = renderHook(() => useWithdrawFromCardMutation(), {
            wrapper,
        })

        result.current.mutate({
            amount: new Decimal(1),
            recipientAddress: 'ALGO_RECIPIENT',
            wallet: usdcWallet,
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('Insufficient balance')
    })
})
