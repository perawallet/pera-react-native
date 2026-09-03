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
import { fetchSpotBanners, closeSpotBanner } from '../endpoints'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    queryClient: vi.fn(),
}))

const DEVICE_ID = 'device-1'

beforeEach(() => {
    vi.clearAllMocks()
})

describe('fetchSpotBanners', () => {
    test('calls queryClient with device URL', async () => {
        ;(queryClient as Mock).mockResolvedValue({ data: [] })

        await fetchSpotBanners('testnet', DEVICE_ID)

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'testnet',
            method: 'GET',
            url: `/v1/devices/${DEVICE_ID}/spot-banners/`,
        })
    })

    test('parses a well-formed response', async () => {
        const data = [
            {
                id: 1,
                text: 'Try',
                image: 'https://cdn.test/img.png',
                url: 'pera://x',
                button_url_is_external: true,
            },
        ]
        ;(queryClient as Mock).mockResolvedValue({ data })

        const result = await fetchSpotBanners('mainnet', DEVICE_ID)

        expect(result[0]).toMatchObject({
            id: '1',
            button_url_is_external: true,
        })
    })

    test('preserves an id above 2^53 delivered as a string', async () => {
        const bigId = '1786243907000000001'
        ;(queryClient as Mock).mockResolvedValue({
            data: [
                {
                    id: bigId,
                    text: 'Try',
                    image: 'https://cdn.test/img.png',
                    url: 'pera://x',
                },
            ],
        })

        const result = await fetchSpotBanners('mainnet', DEVICE_ID)

        expect(result[0].id).toBe(bigId)
    })

    test('throws on schema failure', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: [{ id: 'not-a-number' }],
        })

        await expect(fetchSpotBanners('testnet', DEVICE_ID)).rejects.toThrow()
    })
})

describe('closeSpotBanner', () => {
    test('PATCHes the close URL with no body', async () => {
        ;(queryClient as Mock).mockResolvedValue({ data: null })

        await closeSpotBanner('testnet', DEVICE_ID, 17)

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'testnet',
            method: 'PATCH',
            url: `/v1/devices/${DEVICE_ID}/spot-banners/17/close/`,
        })
    })

    test('propagates errors', async () => {
        ;(queryClient as Mock).mockRejectedValue(new Error('nope'))
        await expect(closeSpotBanner('testnet', DEVICE_ID, 1)).rejects.toThrow(
            'nope',
        )
    })
})
