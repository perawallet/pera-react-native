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

import { describe, expect, test, vi } from 'vitest'
import type { RemoteConfigService } from '@perawallet/wallet-extension-platform'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    isDeviceCountryRestricted,
    parseRestrictedCountries,
} from '../countryRestrictions'

const KEY = 'swap_restricted_countries'

const remoteConfigWith = (value: string | undefined): RemoteConfigService =>
    ({
        getStringValue: (_key: string, fallback = '') => value ?? fallback,
    }) as unknown as RemoteConfigService

const onDeviceIn = (country: string): void => {
    vi.mocked(getProvider).mockReturnValue({
        deviceInfo: { getDeviceCountry: () => country },
    } as unknown as ReturnType<typeof getProvider>)
}

describe('parseRestrictedCountries', () => {
    test.each([
        ['["GB", "us"]', ['GB', 'US']],
        ['[" gb "]', ['GB']],
        ['[]', []],
    ])('reads %s', (json, expected) => {
        expect(parseRestrictedCountries(json)).toEqual(expected)
    })

    test.each(['', 'invalid', '{}', '[1]', '["GBR"]', '"GB"'])(
        'restricts nobody for the malformed %s',
        json => {
            expect(parseRestrictedCountries(json)).toEqual([])
        },
    )
})

describe('isDeviceCountryRestricted', () => {
    test('holds when the device region is listed, whatever its case', () => {
        onDeviceIn('gb')

        expect(isDeviceCountryRestricted(remoteConfigWith('["GB"]'), KEY)).toBe(
            true,
        )
    })

    test('does not hold for an unlisted region or an unset list', () => {
        onDeviceIn('US')

        expect(isDeviceCountryRestricted(remoteConfigWith('["GB"]'), KEY)).toBe(
            false,
        )
        expect(
            isDeviceCountryRestricted(remoteConfigWith(undefined), KEY),
        ).toBe(false)
    })
})
