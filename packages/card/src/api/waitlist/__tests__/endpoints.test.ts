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

import { requestCountryAvailability } from '../endpoints'

describe('waitlist endpoints', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
    })

    test('requestCountryAvailability posts country + device to the Pera backend', async () => {
        queryClientMock.mockResolvedValue({ data: undefined })

        await requestCountryAvailability({
            network: 'mainnet',
            countryCode: 'RU',
            deviceId: 'device-1',
        })

        expect(queryClientMock).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'mainnet',
            method: 'POST',
            url: 'v1/cards/country-availability-request/',
            data: { alpha_2_country_code: 'RU', device: 'device-1' },
            signal: undefined,
        })
    })
})
