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
import { Decimal } from 'decimal.js'

const mockUseNetwork = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mockUseNetwork,
}))

const { fetchExternalWallets } = vi.hoisted(() => ({
    fetchExternalWallets: vi.fn(),
}))
vi.mock('../../api/delegation', () => ({ fetchExternalWallets }))

const mockSession = vi.hoisted(() => ({ isAuthenticated: true }))
vi.mock('../useCardSession', () => ({
    useCardSession: () => ({ isAuthenticated: mockSession.isAuthenticated }),
}))

import { useCardExternalWalletsQuery } from '../useCardExternalWalletsQuery'
import type { CardExternalWallet } from '../../models'

const wallet = (
    overrides: Partial<CardExternalWallet>,
): CardExternalWallet => ({
    address: 'ALGO_ADDR',
    currency: 'usdc',
    balance: new Decimal(0),
    allowance: new Decimal(400),
    network: 'algorand',
    ...overrides,
})

describe('useCardExternalWalletsQuery', () => {
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

    it('matches the delegated wallet by address', async () => {
        fetchExternalWallets.mockResolvedValue([
            wallet({ address: 'OTHER_ADDR' }),
            wallet({ address: 'ALGO_ADDR' }),
        ])

        const { result } = renderHook(
            () => useCardExternalWalletsQuery({ address: 'ALGO_ADDR' }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.delegatedWallet?.address).toBe('ALGO_ADDR')
        expect(result.current.hasActiveDelegation).toBe(true)
    })

    it('reports no active delegation when the allowance is zero', async () => {
        fetchExternalWallets.mockResolvedValue([
            wallet({ allowance: new Decimal(0) }),
        ])

        const { result } = renderHook(
            () => useCardExternalWalletsQuery({ address: 'ALGO_ADDR' }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.delegatedWallet).not.toBeNull()
        expect(result.current.hasActiveDelegation).toBe(false)
    })

    it('returns null without matching when no address is given', async () => {
        fetchExternalWallets.mockResolvedValue([wallet({})])

        const { result } = renderHook(
            () => useCardExternalWalletsQuery({ address: null }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.delegatedWallet).toBeNull()
        expect(result.current.hasActiveDelegation).toBe(false)
    })

    it('stays idle without fetching when the card session is unauthenticated', async () => {
        mockSession.isAuthenticated = false
        fetchExternalWallets.mockResolvedValue([wallet({})])

        renderHook(
            () => useCardExternalWalletsQuery({ address: 'ALGO_ADDR' }),
            { wrapper },
        )

        await new Promise(resolve => setTimeout(resolve, 10))
        expect(fetchExternalWallets).not.toHaveBeenCalled()
    })
})
