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
import { kmsCore } from '@perawallet/wallet-core-kms'
import { deriveHdAccount, hdDeriveOpts } from '../chain-adapter'
import { HdAccountsUnsupportedError } from '../errors'
import {
    FAKE_LOCAL_KEY_KINDS,
    MAINNET_SCOPE,
    fakeAccountsChain,
    registerFakeAccountsChain,
} from './fakeAccountsChain'

describe('hdDeriveOpts', () => {
    it("takes the scheme from the chain's HD key kind and the network from the scope", () => {
        expect(hdDeriveOpts(MAINNET_SCOPE)).toEqual({
            scheme: 'ed25519',
            networkId: 'mainnet',
        })
    })

    it('refuses a chain that declares no HD key kind', () => {
        registerFakeAccountsChain({
            localKeyKinds: FAKE_LOCAL_KEY_KINDS.filter(kind => !kind.isHd),
        })

        expect(() => hdDeriveOpts(MAINNET_SCOPE)).toThrow(
            HdAccountsUnsupportedError,
        )
    })
})

describe('deriveHdAccount', () => {
    it('derives through the registered key derivation with the shared KMS core', async () => {
        const { deriveAccount } = fakeAccountsChain().derivation

        const derived = await deriveHdAccount(MAINNET_SCOPE, 'seed-1', {
            account: 2,
            keyIndex: 5,
        })

        expect(deriveAccount).toHaveBeenCalledWith(kmsCore, 'seed-1', 2, 5, {
            scheme: 'ed25519',
            networkId: 'mainnet',
        })
        expect(derived.keyPairId).toBe('seed-1-acc2-idx5-dt9')
    })
})
