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

import { Decimal } from 'decimal.js'
import { beforeEach, describe, expect, test, vi, type Mock } from 'vitest'
import { queryClient } from '@perawallet/wallet-core-shared'
import { SwapQuoteMismatchError } from '../../../errors'
import type { SwapQuoteRequest } from '../../../models'
import { createSwapQuotes } from '../endpoints'
import {
    routerAsset,
    routerOffer,
    SCOPE_A,
} from '../../__tests__/routerFixtures'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    queryClient: vi.fn(),
}))

const request: SwapQuoteRequest = {
    sourceAsset: { ...SCOPE_A, assetId: 'native' },
    destinationAsset: { ...SCOPE_A, assetId: '31566704' },
    sourceAmount: new Decimal('5000000'),
    sourceAddress: 'SENDER',
    destinationAddress: 'RECEIVER',
    slippage: '0.5',
}

const respondWith = (results: unknown[]) =>
    (queryClient as Mock).mockResolvedValue({ data: { results } })

describe('createSwapQuotes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('sends router ids, router accounts, base units and percent slippage', async () => {
        respondWith([])

        await createSwapQuotes(request)

        expect(queryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                backend: 'pera',
                scope: SCOPE_A,
                method: 'POST',
                url: '/api/v4/swap/quotes/',
                data: {
                    source_asset_id: 'fake-a:main/token:native',
                    destination_asset_id: 'fake-a:main/token:31566704',
                    source_amount: '5000000',
                    source_account: 'fake-a:main:SENDER',
                    destination_account: 'fake-a:main:RECEIVER',
                    slippage: '0.5',
                },
            }),
        )
    })

    test('leaves slippage to the router when none is set', async () => {
        respondWith([])

        await createSwapQuotes({ ...request, slippage: null })

        const [{ data }] = (queryClient as Mock).mock.calls[0]
        expect(data).not.toHaveProperty('slippage')
    })

    test('returns no offers as an empty list', async () => {
        respondWith([])

        expect(await createSwapQuotes(request)).toEqual([])
    })

    test('returns each offer with the request it answers', async () => {
        respondWith([routerOffer()])

        const [quote] = await createSwapQuotes(request)

        expect(quote.request).toBe(request)
    })

    test('refuses an offer for another amount', async () => {
        respondWith([routerOffer({ source_amount: '500000000' })])

        await expect(createSwapQuotes(request)).rejects.toBeInstanceOf(
            SwapQuoteMismatchError,
        )
    })

    test('refuses an offer for another source asset', async () => {
        respondWith([routerOffer({ source_asset: routerAsset(SCOPE_A, '7') })])

        await expect(createSwapQuotes(request)).rejects.toBeInstanceOf(
            SwapQuoteMismatchError,
        )
    })
})
