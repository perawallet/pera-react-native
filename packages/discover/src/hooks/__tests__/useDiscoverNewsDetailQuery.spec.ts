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

// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { useDiscoverNewsDetailQuery } from '../useDiscoverNewsDetailQuery'
import { getDiscoverNewsDetailQueryKey } from '../querykeys'
import * as newsEndpoints from '../../api/news/endpoints'

vi.mock('../../api/news/endpoints')
vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useWalletDeployment: () => 'live',
}))

const ISO = '2026-11-01T10:00:00Z'

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useDiscoverNewsDetailQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('fetches the id and turns publishedAt into a Date', async () => {
        vi.mocked(newsEndpoints.fetchDiscoverNewsDetail).mockResolvedValue({
            id: 'n1',
            title: 'First',
            banner: null,
            publishedAt: ISO,
            contentHtml: '<p>Hi</p>',
        })

        const { result } = renderHook(() => useDiscoverNewsDetailQuery('n1'), {
            wrapper: createWrapper(),
        })
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(newsEndpoints.fetchDiscoverNewsDetail).toHaveBeenCalledWith(
            'live',
            'n1',
            expect.anything(),
        )
        expect(result.current.data?.publishedAt).toEqual(new Date(ISO))
        expect(result.current.data?.contentHtml).toBe('<p>Hi</p>')
    })

    test('keys the cache by deployment and id', () => {
        expect(getDiscoverNewsDetailQueryKey('live', 'n1')).toEqual([
            'discover',
            'news',
            'detail',
            { deployment: 'live', id: 'n1' },
        ])
    })
})
