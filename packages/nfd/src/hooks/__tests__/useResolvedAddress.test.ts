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
import { useResolvedAddress } from '../useResolvedAddress'
import React from 'react'

const mockFetchNfdNamesForAddress = vi.hoisted(() => vi.fn())

vi.mock('../../api', () => ({
    fetchNfdNamesForAddress: mockFetchNfdNamesForAddress,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
    isValidAlgorandAddress: (address?: string) =>
        !!address && /^[0-9a-zA-Z]{58}$/.test(address),
}))

const VALID_ADDRESS = 'A'.repeat(58)

describe('useResolvedAddress', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
        vi.clearAllMocks()
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it('returns NFD name when resolved', async () => {
        mockFetchNfdNamesForAddress.mockResolvedValue([
            { name: 'alice.algo', source: 'nfd', image: '' },
        ])

        const { result } = renderHook(() => useResolvedAddress(VALID_ADDRESS), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isNfd).toBe(true))

        expect(result.current.displayName).toBe('alice.algo')
        expect(result.current.isNfd).toBe(true)
    })

    it('returns truncated address as fallback', async () => {
        mockFetchNfdNamesForAddress.mockResolvedValue([])

        const { result } = renderHook(() => useResolvedAddress(VALID_ADDRESS), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isResolving).toBe(false))

        expect(result.current.displayName).toContain('...')
        expect(result.current.isNfd).toBe(false)
    })

    it('uses long format when specified', async () => {
        mockFetchNfdNamesForAddress.mockResolvedValue([])

        const { result } = renderHook(
            () => useResolvedAddress(VALID_ADDRESS, { format: 'long' }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isResolving).toBe(false))

        // Long format truncates at 20 chars (10...10)
        expect(result.current.displayName.length).toBe(23) // 10 + 3 dots + 10
    })

    it('returns full address when format is full', async () => {
        mockFetchNfdNamesForAddress.mockResolvedValue([])

        const { result } = renderHook(
            () => useResolvedAddress(VALID_ADDRESS, { format: 'full' }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isResolving).toBe(false))

        expect(result.current.displayName).toBe(VALID_ADDRESS)
    })

    it('does not fetch when disabled', () => {
        const { result } = renderHook(
            () => useResolvedAddress(VALID_ADDRESS, { enabled: false }),
            { wrapper },
        )

        expect(result.current.isNfd).toBe(false)
        expect(result.current.displayName).toContain('...')
        expect(mockFetchNfdNamesForAddress).not.toHaveBeenCalled()
    })
})
