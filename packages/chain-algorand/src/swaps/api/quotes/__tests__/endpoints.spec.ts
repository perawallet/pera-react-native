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
import {
    createQuotes,
    calculatePeraFee,
    calculateSwapAmount,
} from '../endpoints'
import type { CreateQuotesRequest } from '../schema'
import type { SwapProviderItem } from '../../../models'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        queryClient: vi.fn(),
    }
})

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

    test('anchors swapperAddress to the request, not the response body', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: {
                results: [
                    {
                        id: 4,
                        provider: 'deflex',
                        asset_in: baseAsset,
                        asset_out: baseAsset,
                    },
                ],
            },
        })

        const result = await createQuotes(request, 'mainnet', providers)

        expect(result[0].swapperAddress).toBe(request.swapper_address)
    })

    test('rejects a quote whose swapper_address differs from the requested address', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: {
                results: [
                    {
                        id: 5,
                        provider: 'deflex',
                        swapper_address: 'ATTACKER_ADDRESS',
                        asset_in: baseAsset,
                        asset_out: baseAsset,
                    },
                ],
            },
        })

        await expect(
            createQuotes(request, 'mainnet', providers),
        ).rejects.toThrow('Quote swapper address does not match')
    })
})

describe('calculatePeraFee', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('POSTs /calculate-pera-fee/ and converts pera_fee_amount to Decimal', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: { pera_fee_amount: 5000, pera_fee_asset_id: 0 },
        })

        const result = await calculatePeraFee(
            {
                address: 'ADDR',
                asset_in_id: 0,
                asset_out_id: 31566704,
                amount_input: '1000000',
            } as never,
            'mainnet',
        )

        expect(queryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/v1/dex-swap/calculate-pera-fee/',
                method: 'POST',
            }),
        )
        expect(result.peraFeeAmount?.toString()).toBe('5000')
        expect(result.peraFeeAssetId).toBe('0')
    })

    test('returns peraFeeAmount undefined when the API omits the field', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: { pera_fee_asset_id: 0 },
        })

        const result = await calculatePeraFee({} as never, 'mainnet')

        expect(result.peraFeeAmount).toBeUndefined()
    })
})

describe('calculateSwapAmount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('POSTs /calculate-swap-amount/ and converts amount + pera_fee to Decimal', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: {
                amount: '1000000',
                pera_fee: '5000',
                pera_fee_asset_id: 0,
            },
        })

        const result = await calculateSwapAmount({} as never, 'mainnet')

        expect(queryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/v1/dex-swap/calculate-swap-amount/',
            }),
        )
        expect(result.amount?.toString()).toBe('1000000')
        expect(result.peraFee?.toString()).toBe('5000')
    })

    test('returns undefined amounts when the API omits them', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: { pera_fee_asset_id: 0 },
        })

        const result = await calculateSwapAmount({} as never, 'mainnet')

        expect(result.amount).toBeUndefined()
        expect(result.peraFee).toBeUndefined()
    })
})
