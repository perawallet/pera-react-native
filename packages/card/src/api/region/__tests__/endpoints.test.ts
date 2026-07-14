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

vi.mock('@perawallet/wallet-core-shared', () => ({
    queryClient: queryClientMock,
}))

import { fetchCurrentRegion } from '../endpoints'

describe('region endpoints', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
    })

    test('fetchCurrentRegion GETs supported-countries and returns the detected region', async () => {
        queryClientMock.mockResolvedValue({
            data: {
                current_region: { alpha_2: 'US', name: 'United States' },
                regions: [
                    { country: { alpha_2_code: 'US' }, is_available: true },
                ],
            },
        })

        const region = await fetchCurrentRegion({ network: 'mainnet' })

        expect(queryClientMock).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'mainnet',
            method: 'GET',
            url: 'v1/cards/supported-countries/',
            signal: undefined,
        })
        expect(region).toEqual({ iso3166alpha2: 'US', name: 'United States' })
    })
})
