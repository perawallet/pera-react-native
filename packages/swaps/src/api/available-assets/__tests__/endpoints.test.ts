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

const queryClientMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return { ...original, queryClient: queryClientMock }
})

import { fetchAvailableAssets } from '../endpoints'

const validAsset = {
    asset_id: 0,
    name: 'Algorand',
    unit_name: 'ALGO',
    fraction_decimals: 6,
    verification_tier: 'verified',
    total_amount: '10000000000',
    logo: null,
    usd_value: '0.20',
}

describe('fetchAvailableAssets', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
    })

    test('GETs /available-assets/ with asset_in_id', async () => {
        queryClientMock.mockResolvedValue({ data: { results: [validAsset] } })

        await fetchAvailableAssets(0, 'mainnet')

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/v1/dex-swap/available-assets/',
                params: { asset_in_id: 0 },
            }),
        )
    })

    test('forwards the q search param when provided', async () => {
        queryClientMock.mockResolvedValue({ data: { results: [] } })

        await fetchAvailableAssets(0, 'mainnet', 'usdc')

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                params: { asset_in_id: 0, q: 'usdc' },
            }),
        )
    })
})
