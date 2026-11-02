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

const flags = vi.hoisted(() => ({
    isDev: false,
    isStaging: false,
    isProd: false,
    isDebug: false,
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    get isDev() {
        return flags.isDev
    },
    get isStaging() {
        return flags.isStaging
    },
    get isProd() {
        return flags.isProd
    },
    get isDebug() {
        return flags.isDebug
    },
}))

import { isV4AssetSyncEnabled } from '../v4-asset-sync-gate'

describe('isV4AssetSyncEnabled', () => {
    test.each([
        ['staging', { isDev: false, isStaging: true, isProd: false }, true],
        ['development', { isDev: true, isStaging: false, isProd: false }, true],
        ['production', { isDev: false, isStaging: false, isProd: true }, false],
    ])('a %s build → %s', (_variant, variant, expected) => {
        Object.assign(flags, variant, { isDebug: false })

        expect(isV4AssetSyncEnabled()).toBe(expected)
    })

    test('a debug build of the production variant stays off', () => {
        Object.assign(flags, {
            isDev: false,
            isStaging: false,
            isProd: true,
            isDebug: true,
        })

        expect(isV4AssetSyncEnabled()).toBe(false)
    })
})
