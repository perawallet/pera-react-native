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
import { fetchBanners } from '../endpoints'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    queryClient: vi.fn(),
}))

const DEVICE_ID = 'device-1'

beforeEach(() => {
    vi.clearAllMocks()
})

describe('fetchBanners', () => {
    test('calls queryClient with the device-scoped URL', async () => {
        const valid = { count: 0, results: [] }
        ;(queryClient as Mock).mockResolvedValue({ data: valid })

        await fetchBanners('testnet', DEVICE_ID)

        expect(queryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'testnet',
            method: 'GET',
            url: `/v1/devices/${DEVICE_ID}/banners/`,
        })
    })

    test('parses a well-formed response', async () => {
        const valid = {
            count: 1,
            results: [
                {
                    id: 1,
                    type: 'governance',
                    title: 'Vote',
                    subtitle: 'Now',
                    button_label: 'Go',
                    button_url: 'pera://gov',
                    button_web_url: 'https://gov',
                    is_button_url_external: false,
                },
            ],
        }
        ;(queryClient as Mock).mockResolvedValue({ data: valid })

        const result = await fetchBanners('mainnet', DEVICE_ID)

        expect(result.count).toBe(1)
        expect(result.results[0].id).toBe('1')
        expect(result.results[0].type).toBe('governance')
    })

    test('preserves an id above 2^53 delivered as a string', async () => {
        // The precision-safe JSON parser surfaces >2^53 ids as strings.
        const bigId = '1786243907000000001'
        ;(queryClient as Mock).mockResolvedValue({
            data: { count: 1, results: [{ id: bigId, type: 'generic' }] },
        })

        const result = await fetchBanners('mainnet', DEVICE_ID)

        expect(result.results[0].id).toBe(bigId)
    })

    test('coerces unknown banner types to generic', async () => {
        const data = {
            count: 1,
            results: [
                {
                    id: 1,
                    type: 'cosmic-event',
                    title: 'Hello',
                },
            ],
        }
        ;(queryClient as Mock).mockResolvedValue({ data })

        const result = await fetchBanners('mainnet', DEVICE_ID)
        expect(result.results[0].type).toBe('generic')
    })

    test('throws on schema failure', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: { results: 'not-an-array' },
        })

        await expect(fetchBanners('testnet', DEVICE_ID)).rejects.toThrow()
    })

    test('propagates queryClient errors', async () => {
        ;(queryClient as Mock).mockRejectedValue(new Error('boom'))
        await expect(fetchBanners('testnet', DEVICE_ID)).rejects.toThrow('boom')
    })
})
