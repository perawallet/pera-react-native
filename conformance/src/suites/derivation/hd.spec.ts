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

/**
 * Derives the address for `mnemonic`/`index` by calling
 * `@algorandfoundation/xhd-wallet-api` directly, bypassing the keystore and its
 * shim wiring entirely.
 */
const deriveAddressViaLibraryDirectly = async (
    mnemonic: string,
    index: number,
): Promise<string> => {
    const rootKey = fromSeed(Buffer.from(await mnemonicToSeed(mnemonic)))
    const publicKey = await new XHDWalletAPI().keyGen(
        rootKey,
        KeyContext.Address,
        0,
        index,
        BIP32DerivationType.Peikert,
    )
    return algosdk.encodeAddress(publicKey)
}

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

        // NOT an independent oracle: keystore-core's default `BIP32-Ed25519`
        // shim binding *is* this same `@algorandfoundation/xhd-wallet-api`
        // package (`keystore-core/src/defaults.ts:92-94`), so this cannot catch
        // a bug in the library's own derivation math — the pinned vector above
        // is the independent check for that. What this proves is narrower but
        // still real: the app's actual call path — mnemonic → BIP39 seed →
        // `fromSeed` → `deriveFromSeed(rootKeyId, path, metadata)` → key export
        // — reproduces the same output as calling the library directly with the
        // same coordinates, so a wiring bug (wrong path segment, wrong
        // derivation-type constant, mis-threaded metadata) would surface here
        // even though a library-math bug would not.
        const expectedAddress = await deriveAddressViaLibraryDirectly(
            account.mnemonic,
            index,
        )

        expect(account.address).toBe(expectedAddress)
    })

    it('funds the library-derived address and the chain credits the keystore-derived one', async () => {
        const ks = await createConformanceKeyStore()
        const index = 7
        // A fresh mnemonic, never the pinned vector: its source file marks
        // EXPECTED_ADDRESS never-fund, and this leg would otherwise fund it.
        const account = await createHdAccount(ks, undefined, index)

        const libraryAddress = await deriveAddressViaLibraryDirectly(
            account.mnemonic,
            index,
        )
        await fundAccount(libraryAddress, 1_000_000n)

        // Funding the library-derived address and querying the keystore-derived
        // one makes this leg sensitive to a wrong derivation: if the two
        // diverged, the queried account would show a zero balance instead of
        // failing to resolve, and this assertion would catch that.
        const info = await getConformanceClient()
            .client.algod.accountInformation(account.address)
            .do()

        expect(BigInt(info.amount)).toBe(1_000_000n)
    })
})
