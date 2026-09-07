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

import { describe, test, expect, vi } from 'vitest'
import type { RemoteConfigService } from '@perawallet/wallet-extension-platform'
import type { RemoteConfigKey } from '../../models'
import { readRemoteConfigWithOverrides } from '../readRemoteConfigWithOverrides'

const makeService = (): RemoteConfigService => ({
    initializeRemoteConfig: vi.fn(),
    getStringValue: vi.fn(() => 'original'),
    getBooleanValue: vi.fn(() => false),
    getNumberValue: vi.fn(() => 0),
})

describe('readRemoteConfigWithOverrides', () => {
    test('returns overrides of the matching type', () => {
        const service = makeService()
        const wrapped = readRemoteConfigWithOverrides(service, {
            string_key: 'overridden',
            bool_key: true,
            number_key: 99,
        })

        expect(wrapped.getStringValue('string_key' as RemoteConfigKey)).toBe(
            'overridden',
        )
        expect(wrapped.getBooleanValue('bool_key' as RemoteConfigKey)).toBe(
            true,
        )
        expect(wrapped.getNumberValue('number_key' as RemoteConfigKey)).toBe(99)
    })

    test('falls through to the real service for un-overridden keys', () => {
        const service = makeService()
        const wrapped = readRemoteConfigWithOverrides(service, {})

        expect(wrapped.getStringValue('other' as RemoteConfigKey)).toBe(
            'original',
        )
        expect(wrapped.getBooleanValue('other' as RemoteConfigKey)).toBe(false)
        expect(wrapped.getNumberValue('other' as RemoteConfigKey)).toBe(0)
    })

    // A boolean override must not satisfy a getStringValue read (and vice
    // versa) — the dev screen writes one key per editor, and a mistyped entry
    // has to fall back to the real value rather than coerce.
    test('ignores an override whose type does not match the getter', () => {
        const service = makeService()
        const wrapped = readRemoteConfigWithOverrides(service, {
            string_key: true,
            bool_key: 'yes',
        })

        expect(wrapped.getStringValue('string_key' as RemoteConfigKey)).toBe(
            'original',
        )
        expect(wrapped.getBooleanValue('bool_key' as RemoteConfigKey)).toBe(
            false,
        )
    })

    test('delegates initializeRemoteConfig to the real service', () => {
        const service = makeService()
        readRemoteConfigWithOverrides(service, {}).initializeRemoteConfig()

        expect(service.initializeRemoteConfig).toHaveBeenCalledTimes(1)
    })
})
