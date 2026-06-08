/*
 Copyright 2022-2025 Pera Wallet, LDA
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

const { fetchCardStatus } = vi.hoisted(() => ({ fetchCardStatus: vi.fn() }))
vi.mock('../../api/card', () => ({ fetchCardStatus }))

import { useCardStatusQuery } from '../useCardStatusQuery'
import { CardStatus, CardType, type Card } from '../../models'

const card: Card = {
    id: 'card_1',
    holderName: 'JANE DOE',
    expiryDate: '2027/05',
    panLast4: '1234',
    status: CardStatus.Active,
    type: CardType.Virtual,
    orderedAt: '2026-01-01T00:00:00Z',
}

describe('useCardStatusQuery', () => {
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

    it('exposes the fetched card', async () => {
        fetchCardStatus.mockResolvedValue(card)

        const { result } = renderHook(() => useCardStatusQuery(), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.data).toEqual(card)
    })

    it('exposes null when the user has no card', async () => {
        fetchCardStatus.mockResolvedValue(null)

        const { result } = renderHook(() => useCardStatusQuery(), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.data).toBeNull()
    })
})
