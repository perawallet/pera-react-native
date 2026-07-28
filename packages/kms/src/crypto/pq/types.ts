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

// Type-only import: erased at compile time, so this does NOT pull algosdk (or
// anything else) into the pure-crypto seam at runtime. It exists so the
// provider contract names the same scheme-id vocabulary the rest of the app
// uses, rather than a hardcoded literal that a second PQ scheme would have to
// widen by hand.
import type { PQSchemeId } from '@perawallet/wallet-core-blockchain'

/**
 * Pure post-quantum signature provider contract.
 *
 * Implementations MUST be pure crypto: no algosdk imports, no address
 * derivation, no digest/hash computation over `message` inside `sign`.
 * Digest contracts belong to the signer / Seam B, out of scope here.
 */
export interface PQSignatureProvider {
    /**
     * Which PQ scheme this provider implements. `useKMS.getPQSigningInfo`
     * reports THIS value rather than a literal of its own, so a provider for a
     * second scheme is self-describing all the way to the wire format.
     */
    readonly scheme: PQSchemeId
    readonly publicKeyLength: number
    generateKeypairFromSeed(seed: Uint8Array): {
        publicKey: Uint8Array
        secretKey: Uint8Array
    }
    /** Signs the raw `message` bytes as given; does not hash/digest them. */
    sign(secretKey: Uint8Array, message: Uint8Array): Uint8Array
}
