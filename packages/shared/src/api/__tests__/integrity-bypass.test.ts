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

import { beforeEach, describe, expect, test, vi } from 'vitest'

const { configFlags } = vi.hoisted(() => ({
    configFlags: { isDev: false, isStaging: false },
}))

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual = await importOriginal<object>()
    return {
        ...actual,
        get isDev() {
            return configFlags.isDev
        },
        get isStaging() {
            return configFlags.isStaging
        },
    }
})

import { addDeviceIntegrityHeader } from '../integrity-bypass'

describe('addDeviceIntegrityHeader', () => {
    beforeEach(() => {
        configFlags.isDev = false
        configFlags.isStaging = false
    })

    test('leaves headers untouched outside dev/staging', () => {
        expect(
            addDeviceIntegrityHeader({ 'x-app-integrity-token': 'tok' }),
        ).toEqual({ 'x-app-integrity-token': 'tok' })
    })

    test('adds the bypass header on a development build', () => {
        configFlags.isDev = true

        expect(
            addDeviceIntegrityHeader({ 'x-app-integrity-token': '' }),
        ).toEqual({
            'x-app-integrity-token': '',
            'x-bypass-integrity': 'DEVELOPMENT_AND_STAGING_ONLY',
        })
    })

    test('adds the bypass header on a staging build', () => {
        configFlags.isStaging = true

        expect(
            addDeviceIntegrityHeader({ 'x-app-integrity-token': 'tok' }),
        ).toEqual({
            'x-app-integrity-token': 'tok',
            'x-bypass-integrity': 'DEVELOPMENT_AND_STAGING_ONLY',
        })
    })

    test('does not mutate the input object', () => {
        const input = { 'x-app-integrity-token': 'tok' }
        configFlags.isDev = true

        addDeviceIntegrityHeader(input)

        expect(input).toEqual({ 'x-app-integrity-token': 'tok' })
    })
})
