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
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        queryClient: queryClientMock,
    }
})

import { fetchPriceHistory } from '../price-history'

describe('fetchPriceHistory', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
    })

    test('reads /v1/assets/price-chart/ for the asset and period on the network', async () => {
        queryClientMock.mockResolvedValue({ data: [] })

        await fetchPriceHistory('123', 'one-day', 'testnet')

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/v1/assets/price-chart/',
                params: { asset_id: '123', period: 'one-day' },
                scope: { chainId: 'algorand', networkId: 'testnet' },
            }),
        )
    })

    test('answers Unix ms timestamps and Decimal USD prices', async () => {
        queryClientMock.mockResolvedValue({
            data: [{ datetime: '2025-01-15T12:00:00Z', price: 2.5 }],
        })

        const [point] = await fetchPriceHistory('123', 'one-day', 'mainnet')

        expect(point?.timestamp).toBe(Date.parse('2025-01-15T12:00:00Z'))
        expect(point?.usdPrice.toFixed()).toBe('2.5')
    })
})
