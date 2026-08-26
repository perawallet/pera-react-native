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
    derivePQKeygenSeed,
    deriveQuantumAddress,
} from '@perawallet/wallet-core-blockchain'
import {
    PQ_DERIVATION_CANONICAL,
    PQ_DERIVATION_LEGACY,
    type PQDerivation,
} from '../models/keys'
import { getPQProvider } from './pq'
import { zeroBytes } from './secure-memory'

export type QuantumAddressCandidate = {
    derivation: PQDerivation
    address: string
}

/**
 * Every address a mnemonic's entropy could authorize under post-quantum
 * derivation, canonical first — without minting a keystore child for either.
 * The import probe and the legacy-account notice both need "what would the
 * other derivation give?" purely to check on-chain existence, so this
 * derives keys in memory and discards them.
 *
 * Legacy fed Falcon the raw entropy; canonical hashes it first via
 * `derivePQKeygenSeed`. Getting the two seeds swapped would point both
 * candidates at the wrong addresses.
 */
export const quantumAddressCandidates = (
    entropy: Uint8Array,
): QuantumAddressCandidate[] => {
    const provider = getPQProvider()
    const canonicalSeed = derivePQKeygenSeed(entropy)
    let canonical:
        | ReturnType<typeof provider.generateKeypairFromSeed>
        | undefined
    let legacy: ReturnType<typeof provider.generateKeypairFromSeed> | undefined

    try {
        canonical = provider.generateKeypairFromSeed(canonicalSeed)
        legacy = provider.generateKeypairFromSeed(entropy)

        return [
            {
                derivation: PQ_DERIVATION_CANONICAL,
                address: deriveQuantumAddress(canonical.publicKey),
            },
            {
                derivation: PQ_DERIVATION_LEGACY,
                address: deriveQuantumAddress(legacy.publicKey),
            },
        ]
    } finally {
        // The engine hands back real Falcon secret-key halves even though
        // only the public key is used here — heap garbage in a managed
        // runtime is still garbage; see useKMSServices.ts's withExportedKey
        // for the same "detached copy the engine won't clean up" rationale.
        zeroBytes(canonicalSeed, canonical?.secretKey, legacy?.secretKey)
    }
}
