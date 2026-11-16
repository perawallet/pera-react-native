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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { fetchDiscoverNewsDetail } from '../endpoints'

const mockQueryClient = vi.fn()

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    queryClient: (...args: unknown[]) => mockQueryClient(...args),
}))

const DETAIL = {
    id: 'n1',
    title: 'First',
    banner: 'https://example.com/1.png',
    publishing_datetime: '2026-11-01T10:00:00Z',
    content_html: '<p>Hello</p>',
}

describe('fetchDiscoverNewsDetail', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('requests the item and keeps its HTML', async () => {
        mockQueryClient.mockResolvedValue({ data: DETAIL })
        const signal = new AbortController().signal

        const result = await fetchDiscoverNewsDetail('live', 'n1', signal)

        expect(mockQueryClient).toHaveBeenCalledWith({
            backend: 'pera',
            deployment: 'live',
            method: 'GET',
            url: '/v1/discover/news/n1/',
            signal,
        })
        expect(result).toEqual({
            id: 'n1',
            title: 'First',
            banner: 'https://example.com/1.png',
            publishedAt: '2026-11-01T10:00:00Z',
            contentHtml: '<p>Hello</p>',
        })
    })

    test('encodes the id into the path', async () => {
        mockQueryClient.mockResolvedValue({ data: { ...DETAIL, id: 'a/b' } })

        await fetchDiscoverNewsDetail('developer', 'a/b')

        expect(mockQueryClient).toHaveBeenCalledWith(
            expect.objectContaining({ url: '/v1/discover/news/a%2Fb/' }),
        )
    })

    test('rejects a response without content_html', async () => {
        const { content_html: _, ...withoutHtml } = DETAIL
        mockQueryClient.mockResolvedValue({ data: withoutHtml })

        await expect(fetchDiscoverNewsDetail('live', 'n1')).rejects.toThrow()
    })
})
