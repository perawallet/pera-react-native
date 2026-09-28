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

import { CardUserUnavailableError } from '../../api/card-creation'
import { useFundingAddressLinkMutation } from '../useFundingAddressLinkMutation'

describe('useFundingAddressLinkMutation', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })
        vi.clearAllMocks()
        mockUseNetwork.mockReturnValue({ network: 'testnet' })
        fetchUser.mockResolvedValue({ id: 'baanx-user-1' })
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it('asks the backend about the address for the signed-in Baanx user', async () => {
        fetchFundingAddressLink.mockResolvedValue({
            state: 'linked_to_other',
            cardAddress: null,
        })
        const { result } = renderHook(() => useFundingAddressLinkMutation(), {
            wrapper,
        })

        await expect(
            result.current.checkFundingAddress('FUNDING_ADDR'),
        ).resolves.toEqual({ state: 'linked_to_other', cardAddress: null })
        expect(fetchFundingAddressLink).toHaveBeenCalledWith({
            network: 'testnet',
            address: 'FUNDING_ADDR',
            baanxUserId: 'baanx-user-1',
        })
    })

    it('rejects without asking when there is no Baanx user', async () => {
        fetchUser.mockResolvedValue(null)
        const { result } = renderHook(() => useFundingAddressLinkMutation(), {
            wrapper,
        })

        await expect(
            result.current.checkFundingAddress('FUNDING_ADDR'),
        ).rejects.toBeInstanceOf(CardUserUnavailableError)
        expect(fetchFundingAddressLink).not.toHaveBeenCalled()
    })
})
