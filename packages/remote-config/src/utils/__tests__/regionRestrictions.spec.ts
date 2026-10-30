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
    isRegionRestricted,
    parseRegionRestrictions,
} from '../regionRestrictions'

const remoteConfigWith = (value: string | undefined): RemoteConfigService =>
    ({
        getStringValue: (_key: string, fallback = '') => value ?? fallback,
    }) as unknown as RemoteConfigService

const onDeviceIn = (country: string): void => {
    vi.mocked(getProvider).mockReturnValue({
        deviceInfo: { getDeviceCountry: () => country },
    } as unknown as ReturnType<typeof getProvider>)
}

describe('parseRegionRestrictions', () => {
    test('reads countries in any case, with their features', () => {
        expect(parseRegionRestrictions('{" gb ": ["swap"], "us": []}')).toEqual(
            { GB: ['swap'], US: [] },
        )
    })

    test.each(['', 'invalid', '[]', '["GB"]', '"GB"', 'null'])(
        'restricts nobody for the malformed %s',
        json => {
            expect(parseRegionRestrictions(json)).toEqual({})
        },
    )

    test('drops only the malformed entries', () => {
        expect(
            parseRegionRestrictions(
                '{"GB": ["swap", 1], "GBR": ["swap"], "US": "swap"}',
            ),
        ).toEqual({ GB: ['swap'] })
    })
})

describe('isRegionRestricted', () => {
    const config = remoteConfigWith('{"GB": ["swap"]}')

    test('holds for a feature restricted in the device region, whatever its case', () => {
        onDeviceIn('gb')

        expect(isRegionRestricted(config, 'swap')).toBe(true)
    })

    test('does not hold for another feature, another region or an unset map', () => {
        onDeviceIn('GB')
        expect(isRegionRestricted(config, 'crypto_promotion')).toBe(false)

        onDeviceIn('US')
        expect(isRegionRestricted(config, 'swap')).toBe(false)
        expect(isRegionRestricted(remoteConfigWith(undefined), 'swap')).toBe(
            false,
        )
    })
})
