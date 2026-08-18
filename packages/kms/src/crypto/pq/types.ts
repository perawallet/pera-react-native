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
 * Pure post-quantum signature provider contract: scheme identity plus
 * deterministic keypair derivation.
 *
 * It does NOT sign. The keystore owns custody — it derives and seals the
 * Falcon private key itself and signs internally, so no secret key is
 * available to hand a provider. What remains is used for address derivation
 * and as an oracle independent of the keystore, which is what lets the quantum
 * fixtures cross-check the keystore's own derivation instead of confirming it
 * against itself.
 *
 * Implementations MUST be pure crypto: no algosdk imports, no address
 * derivation. Digest contracts belong to the signer / Seam B, out of scope
 * here.
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
}

/**
 * The subset of the `@joe-p/react-native-falcon` nitro module surface the
 * on-device provider consumes. Declared here rather than importing the
 * package's own `Falcon` type so consumers of this type — the provider, the
 * off-device accessor — need nothing from `react-native-nitro-modules`.
 *
 * That is narrower than it used to be: `falconModule.native.ts` imports the
 * module's VALUE, and its `Falcon` type extends nitro's `HybridObject`, so
 * typechecking that one file does pull those types in. Hence the explicit
 * `react-native-nitro-modules` devDependency — it was previously resolving
 * only through pnpm's nesting under `@joe-p/react-native-falcon`.
 *
 * All buffers are raw `ArrayBuffer`s: keys are exact-length Falcon-1024 byte
 * blobs. `signCompressed`/`verify` are deliberately absent even though the
 * native module exposes them: the keystore adapts the SAME native module onto
 * its own signing shim and signs from sealed material, so nothing here ever
 * holds a secret key to sign with.
 */
export type NativeFalconModule = {
    /** Falcon-1024 public-key length in bytes (1793). */
    readonly publicKeySize: number
    generateKey(seed?: ArrayBuffer): {
        publicKey: ArrayBuffer
        privateKey: ArrayBuffer
    }
}
