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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    RemoteConfigKeys,
    remoteConfigDefaultsRegistry,
} from '@perawallet/wallet-extension-platform'
import { readBooleanFlagBuildDefault } from '../readBooleanFlagBuildDefault'

const buildFlags = vi.hoisted(() => ({
    isDebug: false,
    isStaging: false,
    isProd: true,
}))

vi.mock('@perawallet/wallet-core-config', async importOriginal => ({
    ...(await importOriginal<object>()),
    get isDebug() {
        return buildFlags.isDebug
    },
    get isStaging() {
        return buildFlags.isStaging
    },
    get isProd() {
        return buildFlags.isProd
    },
}))

const CARD_KEYS = [
    RemoteConfigKeys.enable_pera_card,
    RemoteConfigKeys.enable_card_auto_funding,
    RemoteConfigKeys.enable_card_push_provisioning,
]

describe('readBooleanFlagBuildDefault', () => {
    beforeEach(() => {
        buildFlags.isDebug = false
        buildFlags.isStaging = false
        buildFlags.isProd = true
    })

    afterEach(() => {
        remoteConfigDefaultsRegistry.reset()
    })

    describe.each(CARD_KEYS)('%s', key => {
        it('is on in a debug build', () => {
            buildFlags.isDebug = true

            expect(readBooleanFlagBuildDefault(key)).toBe(true)
        })

        it('is on in a staging build', () => {
            buildFlags.isStaging = true

            expect(readBooleanFlagBuildDefault(key)).toBe(true)
        })

        it('is off in a production release', () => {
            expect(readBooleanFlagBuildDefault(key)).toBe(false)
        })
    })

    describe('enable_device_registration_v4', () => {
        const key = RemoteConfigKeys.enable_device_registration_v4

        it('is on when the variant is not production', () => {
            buildFlags.isProd = false

            expect(readBooleanFlagBuildDefault(key)).toBe(true)
        })

        it('is off for the production variant, debug bundle included', () => {
            buildFlags.isDebug = true

            expect(readBooleanFlagBuildDefault(key)).toBe(false)
        })
    })

    describe('keys without a variant default', () => {
        it('reads the declared default', () => {
            expect(
                readBooleanFlagBuildDefault(
                    RemoteConfigKeys.enable_listed_address_hard_block,
                ),
            ).toBe(true)
            expect(
                readBooleanFlagBuildDefault(RemoteConfigKeys.enable_gift_cards),
            ).toBe(false)
        })

        it('reads a default a chain declared', () => {
            remoteConfigDefaultsRegistry.declare({ test_flag: true })

            expect(readBooleanFlagBuildDefault('test_flag')).toBe(true)
        })

        it('reads false for an undeclared key', () => {
            expect(readBooleanFlagBuildDefault('undeclared_flag')).toBe(false)
        })
    })
})
