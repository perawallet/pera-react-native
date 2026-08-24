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
    BIP32DerivationType,
    fromSeed,
    KeyContext,
    XHDWalletAPI,
} from '@algorandfoundation/xhd-wallet-api'
import { mnemonicToSeed } from '@scure/bip39'
import algosdk from 'algosdk'
import { describe, expect, it } from 'vitest'

import { createHdAccount, fundAccount } from '../../harness/accounts'
import { getConformanceClient } from '../../harness/client'
import { createConformanceKeyStore } from '../../harness/keystore'
import { IN_REPO_HD_VECTOR } from '../../vectors/goAlgorand'

// algokey has no ARC-52 / BIP32-Ed25519 derivation command (verified directly:
// `import`, `export`, `sign`, `multisig`, `part`, `pq` are the whole surface), so
// HD gets a different triple than algo25/quantum: a known-answer vector, parity
// between the keystore's real signing path and the XHD library called directly,
// and on-chain proof.

describe('hd derivation conformance', () => {
    it('reproduces the in-repo pinned vector', async () => {
        const ks = await createConformanceKeyStore()
        const account = await createHdAccount(ks, IN_REPO_HD_VECTOR.mnemonic, 0)

        expect(account.address).toBe(IN_REPO_HD_VECTOR.address)
    })

    it('matches @algorandfoundation/xhd-wallet-api called directly', async () => {
        const ks = await createConformanceKeyStore()
        const index = 5
        const account = await createHdAccount(ks, undefined, index)

        // The independent half of this check: `fromSeed`/`keyGen` called here
        // bypass the app's keystore entirely, so agreement proves the app's
        // deriveFromSeed → BIP32-Ed25519 shim wiring (path building, coordinate
        // metadata, key export) reproduces the untouched library's output for the
        // same mnemonic and coordinates — not merely that the library agrees with
        // itself.
        const rootKey = fromSeed(
            Buffer.from(await mnemonicToSeed(account.mnemonic)),
        )
        const expectedPublicKey = await new XHDWalletAPI().keyGen(
            rootKey,
            KeyContext.Address,
            0,
            index,
            BIP32DerivationType.Peikert,
        )

        expect(account.address).toBe(algosdk.encodeAddress(expectedPublicKey))
    })

    it('is the address the chain credits', async () => {
        const ks = await createConformanceKeyStore()
        const account = await createHdAccount(ks)
        await fundAccount(account.address, 1_000_000n)

        const info = await getConformanceClient()
            .client.algod.accountInformation(account.address)
            .do()

        expect(BigInt(info.amount)).toBe(1_000_000n)
    })
})
