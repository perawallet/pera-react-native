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

import { describe, test, expect, vi, beforeEach, type Mock } from 'vitest'
import { queryClient } from '@perawallet/wallet-core-shared'
import { fetchProviders, fetchTopPairs } from '../endpoints'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        queryClient: vi.fn(),
    }
})

const baseAsset = {
    asset_id: 0,
    verification_tier: 'verified' as const,
}

describe('fetchProviders', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('calls queryClient and transforms provider items', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: {
                results: [
                    {
                        name: 'tinyman',
                        display_name: 'Tinyman',
                        icon_url: 'https://example.com/tinyman.png',
                    },
                ],
            },
        })

        const result = await fetchProviders('mainnet')

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'mainnet',
            method: 'GET',
            url: '/v2/dex-swap/providers/',
        })
        expect(result).toEqual([
            {
                name: 'tinyman',
                displayName: 'Tinyman',
                iconUrl: 'https://example.com/tinyman.png',
            },
        ])
    })
})

describe('fetchTopPairs', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('calls queryClient without params when limit is undefined', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: { results: [] },
        })

        await fetchTopPairs('mainnet')

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'mainnet',
            method: 'GET',
            url: '/v2/dex-swap/top-pairs/',
            params: undefined,
        })
    })

    test('passes limit param and transforms items', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: {
                results: [
                    {
                        asset_a: baseAsset,
                        asset_b: baseAsset,
                        volume_24h_usd: '1234.56',
                    },
                ],
            },
        })

        const result = await fetchTopPairs('mainnet', 10)

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'mainnet',
            method: 'GET',
            url: '/v2/dex-swap/top-pairs/',
            params: { limit: 10 },
        })
        expect(result).toHaveLength(1)
        expect(result[0].volume24hUsd).toBe('1234.56')
    })
})
