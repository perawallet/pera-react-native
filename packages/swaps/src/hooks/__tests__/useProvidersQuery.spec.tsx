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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useProvidersQuery } from '../useProvidersQuery'
import { fetchProviders } from '../../api'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('../../api', () => ({
    fetchProviders: vi.fn(),
}))

const mockProvider = {
    name: 'tinyman-v2' as const,
    displayName: 'Tinyman V2',
    iconUrl: 'https://example.com/icon.png',
}

function createWrapper() {
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

describe('swaps/useProvidersQuery', () => {
    beforeEach(() => {
        vi.mocked(fetchProviders).mockResolvedValue([mockProvider])
    })

    test('returns providers on success', async () => {
        const { result } = renderHook(() => useProvidersQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isFetched).toBe(true))

        expect(result.current.data).toEqual([mockProvider])
        expect(result.current.isError).toBe(false)
    })

    test('starts with empty data while pending', () => {
        vi.mocked(fetchProviders).mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => useProvidersQuery(), {
            wrapper: createWrapper(),
        })

        expect(result.current.data).toEqual([])
        expect(result.current.isPending).toBe(true)
    })

    test('sets isError on failure', async () => {
        vi.mocked(fetchProviders).mockRejectedValue(new Error('Network error'))

        const { result } = renderHook(() => useProvidersQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.data).toEqual([])
        expect(result.current.error).toBeInstanceOf(Error)
    })
})
