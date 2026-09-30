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

import { sha512_256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import type {
    DeriveOpts,
    DiscoveryCandidate,
    KeyDerivation,
} from '@perawallet/wallet-core-chain-contract'
import { SIGNING_ACCESS_DOMAIN } from '@perawallet/wallet-core-kms'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandAddressCodec } from './address-codec'
import { ALGORAND_HD_DERIVATION_TYPE } from './constants'
import { algorandHdDerivationRequest } from './hd-derivation'

const ACCOUNT_GAP_LIMIT = 5
const KEY_INDEX_GAP_LIMIT = 5

// Quantum accounts are minted from a seed through the keystore's Falcon
// generator, not derived along a BIP44 path, so this derivation is Ed25519 only.
const assertEd25519 = (opts: DeriveOpts): void => {
    if (opts.scheme !== 'ed25519') {
        throw new Error(`Algorand HD derivation cannot derive ${opts.scheme}`)
    }
}

export const algorandKeyDerivation: KeyDerivation = {
    chainId: ALGORAND_CHAIN_ID,
    deriveAccount: async (kms, seedRef, account, keyIndex, opts) => {
        assertEd25519(opts)
        const key = await kms.deriveFromSeed(
            seedRef,
            {
                ...algorandHdDerivationRequest(
                    seedRef,
                    account,
                    keyIndex,
                    ALGORAND_HD_DERIVATION_TYPE,
                ),
                scheme: opts.scheme,
            },
            SIGNING_ACCESS_DOMAIN,
        )
        return {
            ...key,
            address: algorandAddressCodec.fromPublicKey(key.publicKey, opts),
        }
    },
    importRawKey: async (kms, bytes, opts) => {
        assertEd25519(opts)
        // Keyed by a hash of the key so the id is stable across imports and
        // never carries key bytes.
        const id = `algorand-raw-${bytesToHex(sha512_256(bytes)).slice(0, 32)}`
        const key = await kms.importRawKey(
            bytes,
            { scheme: opts.scheme, id },
            SIGNING_ACCESS_DOMAIN,
        )
        return {
            keyPairId: key.keyPairId,
            address: algorandAddressCodec.fromPublicKey(key.publicKey, opts),
        }
    },
    discover: async (kms, seedRef, probe, opts) => {
        const found: DiscoveryCandidate[] = []
        for (
            let account = 0, accountMisses = 0;
            accountMisses < ACCOUNT_GAP_LIMIT;
            account++
        ) {
            let accountActive = false
            for (
                let keyIndex = 0, keyMisses = 0;
                keyMisses < KEY_INDEX_GAP_LIMIT;
                keyIndex++
            ) {
                const derived = await algorandKeyDerivation.deriveAccount(
                    kms,
                    seedRef,
                    account,
                    keyIndex,
                    opts,
                )
                if (await probe(derived.address)) {
                    const { address, keyPairId } = derived
                    found.push({ account, keyIndex, address, keyPairId })
                    accountActive = true
                    keyMisses = 0
                } else {
                    keyMisses++
                }
            }
            accountMisses = accountActive ? 0 : accountMisses + 1
        }
        return found
    },
}
