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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'

const mocks = vi.hoisted(() => ({ bootstrapPasskeyAutofill: vi.fn() }))

vi.mock('@perawallet/wallet-core-passkeys', () => ({
    bootstrapPasskeyAutofill: mocks.bootstrapPasskeyAutofill,
}))

import { runPasskeyAutofillBootstrap } from '../passkey-autofill'

describe('runPasskeyAutofillBootstrap', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useRemoteConfigStore.getState().resetState()
        Object.assign(getProvider(), { passkeyAutofill: {} })
    })

    it('bootstraps the credential provider at the Algorand defaults', async () => {
        await runPasskeyAutofillBootstrap()

        expect(mocks.bootstrapPasskeyAutofill).toHaveBeenCalledTimes(1)
    })

    it('does nothing while the liquidAuth capability is off', async () => {
        setCapabilityOverrides({ liquidAuth: false })

        await runPasskeyAutofillBootstrap()

        expect(mocks.bootstrapPasskeyAutofill).not.toHaveBeenCalled()
    })
})
