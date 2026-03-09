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
import { useAvailableAssetsQuery } from '../useAvailableAssetsQuery'
import { fetchAvailableAssets } from '../../api'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('../../api', () => ({
    fetchAvailableAssets: vi.fn(),
}))

const mockAsset = {
    assetId: 31566704,
    name: 'USD Coin',
    unitName: 'USDC',
    verificationTier: 'verified',
    decimals: 6,
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

describe('swaps/useAvailableAssetsQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(fetchAvailableAssets).mockResolvedValue([mockAsset])
    })

    test('returns available assets on success', async () => {
        const { result } = renderHook(() => useAvailableAssetsQuery(0), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isFetched).toBe(true))

        expect(result.current.data).toEqual([mockAsset])
        expect(result.current.isError).toBe(false)
    })

    test('data is undefined while pending', () => {
        vi.mocked(fetchAvailableAssets).mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => useAvailableAssetsQuery(0), {
            wrapper: createWrapper(),
        })

        expect(result.current.data).toBeUndefined()
        expect(result.current.isPending).toBe(true)
    })

    test('is disabled when enabled=false', () => {
        const { result } = renderHook(
            () => useAvailableAssetsQuery(0, undefined, false),
            { wrapper: createWrapper() },
        )

        expect(result.current.isPending).toBe(true)
        expect(fetchAvailableAssets).not.toHaveBeenCalled()
    })

    test('sets isError on failure', async () => {
        vi.mocked(fetchAvailableAssets).mockRejectedValue(
            new Error('Network error'),
        )

        const { result } = renderHook(() => useAvailableAssetsQuery(0), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.data).toBeUndefined()
        expect(result.current.error).toBeInstanceOf(Error)
    })
})
