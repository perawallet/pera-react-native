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

import { describe, expect, it } from 'vitest'
import { RemoteConfigDefaults } from '../models'
import {
    createRemoteConfigDefaultsRegistry,
    DuplicateRemoteConfigKeyError,
} from '../registry'

describe('createRemoteConfigDefaultsRegistry', () => {
    it('serves the platform defaults before anything is declared', () => {
        const registry = createRemoteConfigDefaultsRegistry()

        expect(registry.all()).toEqual(RemoteConfigDefaults)
    })

    it('merges declared defaults over the platform ones', () => {
        const registry = createRemoteConfigDefaultsRegistry()

        registry.declare({ fixture_fee: 7, enable_fixture: true })

        expect(registry.all()).toEqual({
            ...RemoteConfigDefaults,
            fixture_fee: 7,
            enable_fixture: true,
        })
    })

    it('ignores a key declared again with the same value', () => {
        const registry = createRemoteConfigDefaultsRegistry()
        registry.declare({ fixture_fee: 7 })

        expect(() => registry.declare({ fixture_fee: 7 })).not.toThrow()
        expect(registry.all().fixture_fee).toBe(7)
    })

    it('refuses a key declared again with a different value', () => {
        const registry = createRemoteConfigDefaultsRegistry()
        registry.declare({ fixture_fee: 7 })

        expect(() => registry.declare({ fixture_fee: 8 })).toThrow(
            DuplicateRemoteConfigKeyError,
        )
        expect(registry.all().fixture_fee).toBe(7)
    })

    it('refuses a declaration that would shadow a platform default', () => {
        const registry = createRemoteConfigDefaultsRegistry()

        expect(() => registry.declare({ terms_version: '99' })).toThrow(
            expect.objectContaining({ key: 'terms_version' }),
        )
    })

    it('drops every declaration on reset', () => {
        const registry = createRemoteConfigDefaultsRegistry()
        registry.declare({ fixture_fee: 7 })

        registry.reset()

        expect(registry.all()).toEqual(RemoteConfigDefaults)
    })
})
