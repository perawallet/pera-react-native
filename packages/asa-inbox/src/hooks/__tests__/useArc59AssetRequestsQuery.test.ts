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

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useArc59AssetRequestsQuery } from '../useArc59AssetRequestsQuery'

const mocks = vi.hoisted(() => ({
    fetchArc59AssetRequests: vi.fn(),
}))

vi.mock('../../api', () => ({
    fetchArc59AssetRequests: mocks.fetchArc59AssetRequests,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

describe('useArc59AssetRequestsQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    test('fetches asset requests for a valid address', async () => {
        mocks.fetchArc59AssetRequests.mockResolvedValue([])

        const { result } = renderHook(
            () => useArc59AssetRequestsQuery('ADDR1'),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(mocks.fetchArc59AssetRequests).toHaveBeenCalledWith(
            'mainnet',
            'ADDR1',
        )
    })

    test('does not fetch when address is null', () => {
        const { result } = renderHook(() => useArc59AssetRequestsQuery(null), {
            wrapper,
        })

        expect(result.current.fetchStatus).toBe('idle')
        expect(mocks.fetchArc59AssetRequests).not.toHaveBeenCalled()
    })
})
