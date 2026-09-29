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

import {
    createFakeChainKeyStore,
    keyDerivationContractTests,
} from '@perawallet/wallet-core-chain-contract/testing'
import { describe, expect, it } from 'vitest'
import {
    hdDerivedKeyId,
    SIGNING_ACCESS_DOMAIN,
} from '@perawallet/wallet-core-kms'
import { DerivationTypes } from '@perawallet/wallet-core-accounts'
import { algorandAddressCodec } from '../address-codec'
import { algorandKeyDerivation } from '../key-derivation'

const MAINNET = { scheme: 'ed25519', networkId: 'mainnet' } as const

keyDerivationContractTests(() => algorandKeyDerivation, {
    codec: algorandAddressCodec,
    deriveOpts: MAINNET,
    unsupportedOpts: { scheme: 'falcon-1024', networkId: 'mainnet' },
    rawKey: new Uint8Array(32).fill(3),
})

describe('algorandKeyDerivation', () => {
    it('derives along the Algorand BIP44 path under the id the signer resolves', async () => {
        const kms = createFakeChainKeyStore()

        const derived = await algorandKeyDerivation.deriveAccount(
            kms,
            'seed-1',
            2,
            5,
            MAINNET,
        )

        expect(kms.derivations[0]).toMatchObject({
            scheme: 'ed25519',
            path: "m/44'/283'/2'/0/5",
            id: hdDerivedKeyId('seed-1', 2, 5, DerivationTypes.Peikert),
        })
        expect(derived.keyPairId).toBe('seed-1-acc2-idx5-dt9')
    })

    it('derives under the signing access domain', async () => {
        const kms = createFakeChainKeyStore()
        const domains: string[] = []
        const recording = {
            ...kms,
            deriveFromSeed: (
                ...args: Parameters<typeof kms.deriveFromSeed>
            ) => {
                domains.push(args[2])
                return kms.deriveFromSeed(...args)
            },
        }

        await algorandKeyDerivation.deriveAccount(
            recording,
            'seed-1',
            0,
            0,
            MAINNET,
        )

        expect(domains).toEqual([SIGNING_ACCESS_DOMAIN])
    })

    it('never puts key bytes in a raw import id', async () => {
        const kms = createFakeChainKeyStore()
        const rawKey = new Uint8Array(32).fill(0xab)

        await algorandKeyDerivation.importRawKey(kms, rawKey, MAINNET)

        expect(kms.imports[0].id).not.toContain('abab')
    })
})
