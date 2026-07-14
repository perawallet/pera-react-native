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

const { fetchInternalWallets } = vi.hoisted(() => ({
    fetchInternalWallets: vi.fn(),
}))
vi.mock('../../api/wallet', () => ({ fetchInternalWallets }))

const mockSession = vi.hoisted(() => ({ isAuthenticated: true }))
vi.mock('../useCardSession', () => ({
    useCardSession: () => ({ isAuthenticated: mockSession.isAuthenticated }),
}))

import { useCardInternalWalletsQuery } from '../useCardInternalWalletsQuery'
import type { CardInternalWallet } from '../../models'

const wallet = (
    overrides: Partial<CardInternalWallet>,
): CardInternalWallet => ({
    id: 'wallet_1',
    balance: new Decimal('125.50'),
    currency: 'usdc',
    address: 'BAANX_ADDR',
    addressMemo: null,
    addressId: 'addr_1',
    type: 'INTERNAL',
    ...overrides,
})

describe('useCardInternalWalletsQuery', () => {
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

    it('picks the USDC wallet case-insensitively', async () => {
        fetchInternalWallets.mockResolvedValue([
            wallet({ id: 'wallet_xrp', currency: 'xrp' }),
            wallet({ id: 'wallet_usdc', currency: 'usdc' }),
        ])

        const { result } = renderHook(() => useCardInternalWalletsQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.usdcWallet?.id).toBe('wallet_usdc')
    })

    it('stays idle without fetching when the card session is unauthenticated', async () => {
        mockSession.isAuthenticated = false
        fetchInternalWallets.mockResolvedValue([wallet({})])

        const { result } = renderHook(() => useCardInternalWalletsQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(fetchInternalWallets).not.toHaveBeenCalled()
        expect(result.current.usdcWallet).toBeNull()
    })

    it('exposes a null usdcWallet when the response has no USDC wallet', async () => {
        fetchInternalWallets.mockResolvedValue([
            wallet({ id: 'wallet_xrp', currency: 'xrp' }),
        ])

        const { result } = renderHook(() => useCardInternalWalletsQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.usdcWallet).toBeNull()
    })

    it('exposes a null usdcWallet and empty list for an empty response', async () => {
        fetchInternalWallets.mockResolvedValue([])

        const { result } = renderHook(() => useCardInternalWalletsQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.usdcWallet).toBeNull()
    })
})
