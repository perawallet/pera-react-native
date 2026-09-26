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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const mockUseNetwork = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mockUseNetwork,
}))

const { fetchFundingAddressLink } = vi.hoisted(() => ({
    fetchFundingAddressLink: vi.fn(),
}))
vi.mock('../../api/card-creation', async importOriginal => ({
    ...(await importOriginal<object>()),
    fetchFundingAddressLink,
}))

const { fetchUser } = vi.hoisted(() => ({ fetchUser: vi.fn() }))
vi.mock('../../api/user', () => ({ fetchUser }))

const { mockRestoreEscrowCard } = vi.hoisted(() => ({
    mockRestoreEscrowCard: vi.fn(),
}))
vi.mock('../../store', () => ({
    useCardStore: {
        getState: () => ({ restoreEscrowCard: mockRestoreEscrowCard }),
    },
}))

import { CardUserUnavailableError } from '../../api/card-creation'
import { useRestoreEscrowCardMutation } from '../useRestoreEscrowCardMutation'

describe('useRestoreEscrowCardMutation', () => {
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
        fetchUser.mockResolvedValue({ id: 'baanx-user-1' })
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it('restores the card linked to one of the addresses, even when another lookup fails', async () => {
        fetchFundingAddressLink.mockImplementation(
            async ({ address }: { address: string }) => {
                if (address === 'BROKEN') throw new Error('network')
                if (address === 'OWNER') {
                    return { state: 'linked_to_caller', cardAddress: 'CARD1' }
                }
                return { state: 'unlinked', cardAddress: null }
            },
        )
        const { result } = renderHook(() => useRestoreEscrowCardMutation(), {
            wrapper,
        })

        await expect(
            result.current.mutateAsync(['OTHER', 'BROKEN', 'OWNER']),
        ).resolves.toBe('CARD1')
        expect(fetchFundingAddressLink).toHaveBeenCalledWith({
            network: 'mainnet',
            address: 'OWNER',
            baanxUserId: 'baanx-user-1',
        })
        expect(mockRestoreEscrowCard).toHaveBeenCalledWith({
            cardAddress: 'CARD1',
            ownerAddress: 'OWNER',
            network: 'mainnet',
        })
    })

    it('restores nothing when no address holds a card for this user', async () => {
        fetchFundingAddressLink.mockImplementation(
            async ({ address }: { address: string }) =>
                address === 'LINKED_NO_CARD'
                    ? { state: 'linked_to_caller', cardAddress: null }
                    : { state: 'linked_to_other', cardAddress: null },
        )
        const { result } = renderHook(() => useRestoreEscrowCardMutation(), {
            wrapper,
        })

        await expect(
            result.current.mutateAsync(['LINKED_NO_CARD', 'SOMEONE_ELSE']),
        ).resolves.toBeNull()
        expect(mockRestoreEscrowCard).not.toHaveBeenCalled()
    })

    it('skips the backend entirely when there are no addresses to check', async () => {
        const { result } = renderHook(() => useRestoreEscrowCardMutation(), {
            wrapper,
        })

        await expect(result.current.mutateAsync([])).resolves.toBeNull()
        expect(fetchUser).not.toHaveBeenCalled()
    })

    it('rejects without asking when there is no Baanx user', async () => {
        fetchUser.mockResolvedValue(null)
        const { result } = renderHook(() => useRestoreEscrowCardMutation(), {
            wrapper,
        })

        await expect(
            result.current.mutateAsync(['OWNER']),
        ).rejects.toBeInstanceOf(CardUserUnavailableError)
        expect(fetchFundingAddressLink).not.toHaveBeenCalled()
    })
})
