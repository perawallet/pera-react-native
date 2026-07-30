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

import { describe, test, expect } from 'vitest'
import {
    config,
    configSchema,
    getConfig,
    overrideEnvironmentMap,
} from '../main'

describe('config/main', () => {
    test('config object is frozen', () => {
        expect(Object.isFrozen(config)).toBe(true)
    })

    test('config matches schema', () => {
        const result = configSchema.safeParse(config)
        expect(result.success).toBe(true)
    })

    test('getConfig returns a valid config', () => {
        const result = getConfig()
        expect(configSchema.safeParse(result).success).toBe(true)
    })

    // Production needs backend overrides: the committed staging defaults
    // would otherwise (correctly) trip the production staging-URL guard.
    test.each([
        ['production', 'https://discover-mobile.perawallet.app/'],
        ['staging', 'https://discover-mobile-staging.perawallet.app/'],
        ['development', 'https://discover-mobile-staging.perawallet.app/'],
    ] as const)(
        'uses the expected Discover URL for %s builds',
        (appEnvironment, expectedUrl) => {
            const overrides =
                appEnvironment === 'production'
                    ? {
                          appEnvironment,
                          mainnetBackendUrl:
                              'https://mainnet.api.perawallet.app',
                          testnetBackendUrl:
                              'https://testnet.api.perawallet.app',
                      }
                    : { appEnvironment }
            expect(getConfig(overrides).discoverBaseUrl).toBe(expectedUrl)
        },
    )

    test('does not expose obsolete staking or onramp URLs', () => {
        expect('stakingBaseUrl' in config).toBe(false)
        expect('onrampBaseUrl' in config).toBe(false)
    })

    test('does not map obsolete web-feature URL environment variables', () => {
        expect(overrideEnvironmentMap).not.toHaveProperty('discoverBaseUrl')
        expect(overrideEnvironmentMap).not.toHaveProperty('stakingBaseUrl')
        expect(overrideEnvironmentMap).not.toHaveProperty('onrampBaseUrl')
    })

    test('exposes bounded-timeout defaults in milliseconds', () => {
        expect(config.algodReadTimeout).toBe(10_000)
        expect(config.algodSubmitTimeout).toBe(30_000)
        expect(config.signingTransportTimeout).toBe(35_000)
    })

    test('schema rejects a non-integer algodReadTimeout', () => {
        const result = configSchema.safeParse({
            ...config,
            algodReadTimeout: 10.5,
        })
        expect(result.success).toBe(false)
    })
})
