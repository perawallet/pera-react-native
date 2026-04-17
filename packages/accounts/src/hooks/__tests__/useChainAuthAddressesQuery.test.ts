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

import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useChainAuthAddressesQuery } from '../useChainAuthAddressesQuery'
import type { Network } from '@perawallet/wallet-core-shared'

const mockGetAllAccountBalances = vi.fn()

vi.mock('../../db', () => ({
    getAllAccountBalances: (...args: unknown[]) =>
        mockGetAllAccountBalances(...args),
}))

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

describe('useChainAuthAddressesQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns a Map<address, authAddress | null>', async () => {
        mockGetAllAccountBalances.mockResolvedValue([
            { accountAddress: 'A', authAddress: 'S' },
            { accountAddress: 'B', authAddress: null },
        ])

        const { result } = renderHook(
            () =>
                useChainAuthAddressesQuery({
                    addresses: ['A', 'B'],
                    network: 'mainnet' as Network,
                }),
            { wrapper: createWrapper() },
        )

        await waitFor(() =>
            expect(result.current.chainAuthAddresses.get('A')).toBe('S'),
        )
        expect(result.current.chainAuthAddresses.get('B')).toBeNull()
    })

    it('returns an empty map when no addresses are provided', () => {
        const { result } = renderHook(
            () =>
                useChainAuthAddressesQuery({
                    addresses: [],
                    network: 'mainnet' as Network,
                }),
            { wrapper: createWrapper() },
        )

        expect(result.current.chainAuthAddresses.size).toBe(0)
        expect(mockGetAllAccountBalances).not.toHaveBeenCalled()
    })
})
