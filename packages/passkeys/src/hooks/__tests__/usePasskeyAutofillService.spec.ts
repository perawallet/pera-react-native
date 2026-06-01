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

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getProvider: vi.fn() }))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: mocks.getProvider,
}))

import { usePasskeyAutofillService } from '../usePasskeyAutofillService'
import { PasskeyAutofillUnavailableError } from '../../errors'

describe('usePasskeyAutofillService', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns the passkeyAutofill service registered on the provider', () => {
        const passkeyAutofill = { isProviderActive: vi.fn() }
        mocks.getProvider.mockReturnValue({ passkeyAutofill })

        expect(usePasskeyAutofillService()).toBe(passkeyAutofill)
    })

    it('throws PasskeyAutofillUnavailableError when the extension was not composed', () => {
        mocks.getProvider.mockReturnValue({})

        expect(() => usePasskeyAutofillService()).toThrow(
            PasskeyAutofillUnavailableError,
        )
    })
})
