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
import { fetchSwapHistory, fetchDistinctPairsHistory } from '../endpoints'

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

const historyItem = {
    id: 1,
    id_str: '1',
    provider: 'tinyman',
    status: 'completed' as const,
    completed_datetime: '2024-01-01T00:00:00Z',
    transaction_group_id: 'gid',
    asset_in: baseAsset,
    asset_out: baseAsset,
    amount_in: '1000',
    amount_out: '2000',
    amount_in_usd_value: '1.00',
    amount_out_usd_value: '2.00',
}

const distinctPairItem = {
    asset_in: baseAsset,
    asset_out: baseAsset,
    swap_datetime: '2024-01-01T00:00:00Z',
    pair_key: '0-31566704',
}

describe('fetchSwapHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('calls queryClient with address and transforms results', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: {
                results: [historyItem],
                next: 'next-cursor',
                previous: null,
            },
        })

        const result = await fetchSwapHistory('ADDRESS', 'mainnet')

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'mainnet',
            method: 'GET',
            url: '/v2/dex-swap/history/',
            params: { address: 'ADDRESS' },
        })
        expect(result.results).toHaveLength(1)
        expect(result.results[0].id).toBe('1')
        expect(result.results[0].amountIn.toString()).toBe('1000')
        expect(result.next).toBe('next-cursor')
        expect(result.previous).toBeNull()
    })

    test('includes optional statuses, cursor and limit params when provided', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: { results: [], next: null, previous: null },
        })

        await fetchSwapHistory('ADDRESS', 'mainnet', 'completed', 'cursor1', 25)

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'mainnet',
            method: 'GET',
            url: '/v2/dex-swap/history/',
            params: {
                address: 'ADDRESS',
                statuses: 'completed',
                cursor: 'cursor1',
                limit: 25,
            },
        })
    })
})

describe('fetchDistinctPairsHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('calls queryClient and transforms items', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: { results: [distinctPairItem] },
        })

        const result = await fetchDistinctPairsHistory('ADDRESS', 'mainnet')

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'mainnet',
            method: 'GET',
            url: '/v2/dex-swap/distinct-pairs-history/',
            params: { address: 'ADDRESS' },
        })
        expect(result).toHaveLength(1)
        expect(result[0].pairKey).toBe('0-31566704')
    })

    test('includes statuses when provided', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: { results: [] },
        })

        await fetchDistinctPairsHistory('ADDRESS', 'mainnet', 'completed')

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'mainnet',
            method: 'GET',
            url: '/v2/dex-swap/distinct-pairs-history/',
            params: { address: 'ADDRESS', statuses: 'completed' },
        })
    })
})
