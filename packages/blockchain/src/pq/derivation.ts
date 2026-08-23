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

import { sha512_256 } from '@noble/hashes/sha2'
import { DEFAULT_PQ_SCHEME_ID, PQ_SCHEMES, type PQSchemeId } from './schemes'

/** `protocol.PostQuantumKey` — go-algorand's PQ keygen-seed domain prefix. */
const PQ_KEY_PREFIX = new TextEncoder().encode('PQK')

/**
 * The Falcon keygen seed for a wallet's 32 bytes of algo25 mnemonic entropy.
 *
 * `SHA512_256("PQK" || scheme || entropy)`, matching `derivePQKeySeed` in
 * go-algorand's `cmd/algokey/pq_scheme.go`. Feeding Falcon the raw entropy
 * instead yields a valid but non-canonical account — the same mnemonic then
 * restores a different address in algokey, goal and every other Algorand tool.
 *
 * @param entropy 32 bytes of algo25 mnemonic entropy. Not mutated.
 * @returns 32-byte keygen seed. Secret material — zero it after use.
 */
export const derivePQKeygenSeed = (
    entropy: Uint8Array,
    schemeId: PQSchemeId = DEFAULT_PQ_SCHEME_ID,
): Uint8Array => {
    const scheme = PQ_SCHEMES[schemeId]
    const preimage = new Uint8Array(
        PQ_KEY_PREFIX.length + scheme.length + entropy.length,
    )
    preimage.set(PQ_KEY_PREFIX, 0)
    preimage.set(scheme, PQ_KEY_PREFIX.length)
    preimage.set(entropy, PQ_KEY_PREFIX.length + scheme.length)

    try {
        return sha512_256(preimage)
    } finally {
        preimage.fill(0)
    }
}
