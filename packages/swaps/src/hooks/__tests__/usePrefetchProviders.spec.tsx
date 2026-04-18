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

import { describe, test, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { usePrefetchProviders } from '../usePrefetchProviders'
import { fetchProviders } from '../../api'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('../../api', () => ({
    fetchProviders: vi.fn(),
}))

describe('usePrefetchProviders', () => {
    test('prefetches providers for the active network when the returned fn is called', async () => {
        const fetchMock = vi.mocked(fetchProviders)
        fetchMock.mockResolvedValue([])

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )

        const { result } = renderHook(() => usePrefetchProviders(), { wrapper })

        act(() => {
            result.current()
        })

        // prefetchQuery fires the queryFn asynchronously
        await vi.waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith('mainnet'),
        )
    })
})
