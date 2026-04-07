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
import { useNfdForAddress } from '../useNfdForAddress'
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

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        reactQueryLongLivedStaleTime: 7 * 24 * 60 * 60 * 1000,
        reactQueryLongLivedGCTime: 21 * 24 * 60 * 60 * 1000,
    },
}))

const VALID_ADDRESS = 'A'.repeat(58)

describe('useNfdForAddress', () => {
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

    it('returns nfdName after successful resolution', async () => {
        mockFetchNfdNamesForAddress.mockResolvedValue([
            {
                name: 'alice.algo',
                source: 'nfd',
                image: 'https://example.com/img.png',
            },
        ])

        const { result } = renderHook(() => useNfdForAddress(VALID_ADDRESS), {
            wrapper,
        })

        await waitFor(() => expect(result.current.nfdName).toBe('alice.algo'))
    })

    it('returns undefined nfdName while loading', () => {
        mockFetchNfdNamesForAddress.mockImplementation(
            () => new Promise(() => {}),
        )

        const { result } = renderHook(() => useNfdForAddress(VALID_ADDRESS), {
            wrapper,
        })

        expect(result.current.nfdName).toBeUndefined()
        expect(result.current.isResolving).toBe(true)
    })

    it('returns undefined when no NFD names found', async () => {
        mockFetchNfdNamesForAddress.mockResolvedValue([])

        const { result } = renderHook(() => useNfdForAddress(VALID_ADDRESS), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isResolving).toBe(false))

        expect(result.current.nfdName).toBeUndefined()
    })

    it('does not fetch when enabled is false', () => {
        const { result } = renderHook(
            () => useNfdForAddress(VALID_ADDRESS, { enabled: false }),
            { wrapper },
        )

        expect(result.current.nfdName).toBeUndefined()
        expect(mockFetchNfdNamesForAddress).not.toHaveBeenCalled()
    })

    it('does not fetch for invalid address', () => {
        const { result } = renderHook(
            () => useNfdForAddress('invalid-address'),
            { wrapper },
        )

        expect(result.current.nfdName).toBeUndefined()
        expect(mockFetchNfdNamesForAddress).not.toHaveBeenCalled()
    })

    it('returns the first NFD name when multiple exist', async () => {
        mockFetchNfdNamesForAddress.mockResolvedValue([
            { name: 'primary.algo', source: 'nfd', image: '' },
            { name: 'secondary.algo', source: 'nfd', image: '' },
        ])

        const { result } = renderHook(() => useNfdForAddress(VALID_ADDRESS), {
            wrapper,
        })

        await waitFor(() => expect(result.current.nfdName).toBe('primary.algo'))
    })
})
