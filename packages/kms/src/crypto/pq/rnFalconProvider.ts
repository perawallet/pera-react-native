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

// SWAP: joe-p native Falcon-1024 (`@joe-p/react-native-falcon`, a nitro C++
// HybridObject). Seam A on-device implementation — replace alongside the WASM
// provider with the official PQ crypto lib per docs/QUANTUM_PQ_INTEGRATION.md.
//
// This file lives INSIDE the Seam A dir (`crypto/pq/`), so importing the native
// module here does NOT breach the two-seam PQ-library firewall
// (pqLibraryFirewall.spec.ts). It is the sole sanctioned on-device home.
import type { PQSignatureProvider } from './types'

/**
 * The subset of the `@joe-p/react-native-falcon` nitro module surface this
 * provider consumes. Declared locally (rather than importing the package's
 * `Falcon` type) so the pure-logic KMS package does not take a compile-time
 * dependency on `react-native-nitro-modules`' `HybridObject` types.
 *
 * All buffers are raw `ArrayBuffer`s: keys and signatures are exact-length
 * Falcon-1024 byte blobs. `signCompressed` signs the raw `message` bytes as
 * given (no hashing/digesting), matching the {@link PQSignatureProvider}
 * contract.
 */
type NativeFalconModule = {
    /** Falcon-1024 public-key length in bytes (1793). */
    readonly publicKeySize: number
    generateKey(seed?: ArrayBuffer): {
        publicKey: ArrayBuffer
        privateKey: ArrayBuffer
    }
    signCompressed(privateKey: ArrayBuffer, message: ArrayBuffer): ArrayBuffer
}

/**
 * Copy a `Uint8Array` view into a fresh, exact-length `ArrayBuffer`. A plain
 * `.buffer` access is unsafe: the view may cover only part of a larger backing
 * buffer (non-zero `byteOffset` / shorter `byteLength`), which the native side
 * would read past.
 */
const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(buffer).set(bytes)
    return buffer
}

/**
 * Native on-device Falcon-1024 signature provider backed by the nitro module.
 *
 * Loaded lazily via `require` (not a top-level `import`) so that merely
 * importing this file — e.g. through `getPQProvider`'s static import graph in
 * node/test environments, which never take the React Native branch — does not
 * pull in the native module (whose entry point instantiates the HybridObject
 * at load time and throws off-device). The `require` only executes on-device,
 * when `getPQProvider` selects this provider.
 */
export const createRNFalconProvider = (): PQSignatureProvider => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FalconModule } = require('@joe-p/react-native-falcon') as {
        FalconModule: NativeFalconModule
    }

    return {
        scheme: 'falcon1024',
        publicKeyLength: FalconModule.publicKeySize,
        generateKeypairFromSeed(seed) {
            const { publicKey, privateKey } = FalconModule.generateKey(
                toArrayBuffer(seed),
            )
            return {
                publicKey: new Uint8Array(publicKey),
                secretKey: new Uint8Array(privateKey),
            }
        },
        sign(secretKey, message) {
            return new Uint8Array(
                FalconModule.signCompressed(
                    toArrayBuffer(secretKey),
                    toArrayBuffer(message),
                ),
            )
        },
    }
}
