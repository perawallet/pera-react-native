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

import { describe, test, expect, vi, beforeEach, Mock } from 'vitest'
import { queryClient } from '@perawallet/wallet-core-shared'
import { createQuotes } from '../endpoints'
import type { CreateQuotesRequest } from '../schema'
import type { SwapProviderItem } from '../../../models'

vi.mock('@perawallet/wallet-core-shared', () => ({
    queryClient: vi.fn(),
}))

const request: CreateQuotesRequest = {
    swapper_address: 'ALGO_ADDRESS',
    swap_type: 'fixed-input',
    asset_in_id: 0,
    asset_out_id: 31566704,
    amount: '1000000',
}

const baseAsset = {
    asset_id: 0,
    verification_tier: 'verified' as const,
}

const providers: SwapProviderItem[] = [
    { name: 'deflex', displayName: 'Deflex', iconUrl: 'https://x/deflex.png' },
    {
        name: 'tinyman',
        displayName: 'Tinyman V2',
        iconUrl: 'https://x/tinyman.png',
    },
]

describe('createQuotes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('attaches providerDisplayName by matching raw provider name', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: {
                results: [
                    {
                        id: 1,
                        provider: 'deflex',
                        asset_in: baseAsset,
                        asset_out: baseAsset,
                    },
                    {
                        id: 2,
                        provider: 'tinyman',
                        asset_in: baseAsset,
                        asset_out: baseAsset,
                    },
                ],
            },
        })

        const result = await createQuotes(request, 'mainnet', providers)

        expect(result[0].provider).toBe('deflex')
        expect(result[0].providerDisplayName).toBe('Deflex')
        expect(result[1].provider).toBe('tinyman')
        expect(result[1].providerDisplayName).toBe('Tinyman V2')
    })

    test('leaves providerDisplayName undefined when provider is unknown', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: {
                results: [
                    {
                        id: 3,
                        provider: 'unknown-dex',
                        asset_in: baseAsset,
                        asset_out: baseAsset,
                    },
                ],
            },
        })

        const result = await createQuotes(request, 'mainnet', providers)

        expect(result[0].provider).toBe('unknown-dex')
        expect(result[0].providerDisplayName).toBeUndefined()
    })
})
