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

/**
 * Pure post-quantum signature provider contract.
 *
 * Implementations MUST be pure crypto: no algosdk imports, no address
 * derivation, no digest/hash computation over `message` inside `sign`.
 * Digest contracts belong to the signer / Seam B, out of scope here.
 */
export interface PQSignatureProvider {
    readonly scheme: 'falcon1024'
    readonly publicKeyLength: number
    generateKeypairFromSeed(seed: Uint8Array): {
        publicKey: Uint8Array
        secretKey: Uint8Array
    }
    /** Signs the raw `message` bytes as given; does not hash/digest them. */
    sign(secretKey: Uint8Array, message: Uint8Array): Uint8Array
}
