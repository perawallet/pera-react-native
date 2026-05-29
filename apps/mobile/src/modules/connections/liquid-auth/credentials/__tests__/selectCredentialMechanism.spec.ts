/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createInAppCredentialMechanism } from '../inAppMechanism'
import { createOsPasskeyCredentialMechanism } from '../osPasskeyMechanism'
import { selectLiquidAuthCredentialMechanism } from '../selectCredentialMechanism'

vi.mock('../inAppMechanism', () => ({
    createInAppCredentialMechanism: vi.fn(() => ({
        get: vi.fn(),
        create: vi.fn(),
    })),
}))

vi.mock('../osPasskeyMechanism', () => ({
    createOsPasskeyCredentialMechanism: vi.fn(() => ({
        get: vi.fn(),
        create: vi.fn(),
    })),
}))

const mockCreateInApp = vi.mocked(createInAppCredentialMechanism)
const mockCreateOsPasskey = vi.mocked(createOsPasskeyCredentialMechanism)

describe('selectLiquidAuthCredentialMechanism', () => {
    afterEach(() => {
        vi.clearAllMocks()
    })

    it('uses the OS-native passkey mechanism when in-app is disabled', () => {
        selectLiquidAuthCredentialMechanism(false)

        expect(mockCreateOsPasskey).toHaveBeenCalledTimes(1)
        expect(mockCreateInApp).not.toHaveBeenCalled()
    })

    it('uses the in-app mechanism when in-app is enabled', () => {
        selectLiquidAuthCredentialMechanism(true)

        expect(mockCreateInApp).toHaveBeenCalledTimes(1)
        expect(mockCreateOsPasskey).not.toHaveBeenCalled()
    })
})
