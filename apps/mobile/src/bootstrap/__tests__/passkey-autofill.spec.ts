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

// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generatePasskeyMainKey } from '@perawallet/wallet-core-kms'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import {
    ETHEREUM_CHAIN_ID,
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'

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

    afterEach(() => {
        restoreAlgorandOnlyChains()
    })

    it('bootstraps the credential provider at the Algorand defaults', async () => {
        await runPasskeyAutofillBootstrap()

        expect(mocks.bootstrapPasskeyAutofill).toHaveBeenCalledTimes(1)
    })

    it('mints the main key on the provider keystore', async () => {
        await runPasskeyAutofillBootstrap()
        const [{ mintPasskeyMainKey }] =
            mocks.bootstrapPasskeyAutofill.mock.calls[0]

        await mintPasskeyMainKey('wallet', 'wallet/entropy')

        expect(generatePasskeyMainKey).toHaveBeenCalledWith(
            getProvider().key.store,
            'wallet',
            'wallet/entropy',
        )
    })

    it('refreshes registration approval again if the wallet changes during bootstrap', async () => {
        let finishBootstrap!: () => void
        mocks.bootstrapPasskeyAutofill.mockReturnValueOnce(
            new Promise<void>(resolve => {
                finishBootstrap = resolve
            }),
        )

        const first = runPasskeyAutofillBootstrap()
        const refresh = runPasskeyAutofillBootstrap()
        expect(mocks.bootstrapPasskeyAutofill).toHaveBeenCalledTimes(1)

        finishBootstrap()
        await Promise.all([first, refresh])

        expect(mocks.bootstrapPasskeyAutofill).toHaveBeenCalledTimes(2)
    })

    it('does nothing while the liquidAuth capability is off', async () => {
        setCapabilityOverrides({ liquidAuth: false })

        await runPasskeyAutofillBootstrap()

        expect(mocks.bootstrapPasskeyAutofill).not.toHaveBeenCalled()
    })

    it('bootstraps when any registered chain has liquidAuth', async () => {
        registerEthereumChain()
        setCapabilityOverrides({ liquidAuth: false }, ETHEREUM_CHAIN_ID)

        await runPasskeyAutofillBootstrap()

        expect(mocks.bootstrapPasskeyAutofill).toHaveBeenCalledTimes(1)
    })
})
