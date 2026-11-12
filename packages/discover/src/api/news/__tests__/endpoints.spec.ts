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
import { fetchDiscoverNews } from '../endpoints'

const mockQueryClient = vi.fn()

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    queryClient: (...args: unknown[]) => mockQueryClient(...args),
}))

describe('fetchDiscoverNews', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('requests the first page and keeps publishedAt as the ISO string', async () => {
        mockQueryClient.mockResolvedValue({
            data: {
                next: 'https://example.com/v1/discover/news/?page=2',
                previous: null,
                results: [
                    {
                        id: 'n1',
                        title: 'First',
                        banner: 'https://example.com/1.png',
                        publishing_datetime: '2026-11-01T10:00:00Z',
                    },
                    {
                        id: 'n2',
                        title: 'Second',
                        publishing_datetime: '2026-10-30T08:30:00Z',
                    },
                ],
            },
        })
        const signal = new AbortController().signal

        const result = await fetchDiscoverNews('live', signal)

        expect(mockQueryClient).toHaveBeenCalledWith({
            backend: 'pera',
            deployment: 'live',
            method: 'GET',
            url: '/v1/discover/news/',
            signal,
        })
        expect(result).toEqual([
            {
                id: 'n1',
                title: 'First',
                banner: 'https://example.com/1.png',
                publishedAt: '2026-11-01T10:00:00Z',
            },
            {
                id: 'n2',
                title: 'Second',
                banner: null,
                publishedAt: '2026-10-30T08:30:00Z',
            },
        ])
    })

    test('returns [] for an empty page', async () => {
        mockQueryClient.mockResolvedValue({
            data: { next: null, previous: null, results: [] },
        })

        expect(await fetchDiscoverNews('developer')).toEqual([])
    })

    test('maps an explicit null banner to null', async () => {
        mockQueryClient.mockResolvedValue({
            data: {
                next: null,
                previous: null,
                results: [
                    {
                        id: 'n3',
                        title: 'Third',
                        banner: null,
                        publishing_datetime: '2026-10-29T00:00:00Z',
                    },
                ],
            },
        })

        const [item] = await fetchDiscoverNews('live')

        expect(item.banner).toBeNull()
    })
})
