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
import { deriveHdAccount } from '../chain-adapter'
import { HdDerivationTypeUnsupportedError } from '../errors'
import { DerivationTypes } from '../models'
import { fakeAccountsChain, FAKE_CHAIN_ID } from './fakeAccountsChain'

describe('deriveHdAccount', () => {
    it('derives through the registered key derivation with the shared KMS core', async () => {
        const { deriveAccount } = fakeAccountsChain().derivation

        const derived = await deriveHdAccount('mainnet', 'seed-1', {
            account: 2,
            keyIndex: 5,
        })

        expect(deriveAccount).toHaveBeenCalledWith(kmsCore, 'seed-1', 2, 5, {
            scheme: 'ed25519',
            networkId: 'mainnet',
        })
        expect(derived.keyPairId).toBe('seed-1-acc2-idx5-dt9')
    })

    it('derives when the requested type is the chain’s own', async () => {
        const { deriveAccount } = fakeAccountsChain().derivation

        await deriveHdAccount('mainnet', 'seed-1', {
            account: 0,
            keyIndex: 0,
            derivationType: DerivationTypes.Peikert,
        })

        expect(deriveAccount).toHaveBeenCalledTimes(1)
    })

    it('refuses another derivation type without deriving', async () => {
        const { deriveAccount } = fakeAccountsChain().derivation

        await expect(
            deriveHdAccount('mainnet', 'seed-1', {
                account: 0,
                keyIndex: 0,
                derivationType: DerivationTypes.Khovratovich,
            }),
        ).rejects.toEqual(
            expect.objectContaining({
                name: HdDerivationTypeUnsupportedError.name,
                chainId: FAKE_CHAIN_ID,
            }),
        )
        expect(deriveAccount).not.toHaveBeenCalled()
    })
})
