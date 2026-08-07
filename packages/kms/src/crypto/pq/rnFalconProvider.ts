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
 * All buffers are raw `ArrayBuffer`s: keys are exact-length Falcon-1024 byte
 * blobs. The module's signing entry point is deliberately absent — the
 * keystore installs its own binding onto this same native module and signs
 * from sealed material, so nothing here ever holds a secret key to sign with.
 */
type NativeFalconModule = {
    /** Falcon-1024 public-key length in bytes (1793). */
    readonly publicKeySize: number
    generateKey(seed?: ArrayBuffer): {
        publicKey: ArrayBuffer
        privateKey: ArrayBuffer
    }
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
 * Provider selection is a build-time choice, not a runtime branch: Metro
 * resolves `getPQProvider.native.ts` (which calls this factory) in place of
 * the base `getPQProvider.ts` (WASM) for the `ios`/`android` platforms, via
 * its standard `.native.*` platform-extension resolution — there is no
 * runtime check deciding between them.
 *
 * That selection does not make this file's `require` safe to make eager,
 * though: the pq barrel (`index.ts`) re-exports `createRNFalconProvider`
 * directly, independent of which `getPQProvider` variant the bundler picked.
 * So merely importing the barrel — e.g. in node/test environments, off-device
 * — still imports this file. Loaded lazily via `require` (not a top-level
 * `import`), the native module's entry point (which instantiates the
 * HybridObject at load time and throws off-device) is only evaluated when
 * `createRNFalconProvider` is actually called, not on import.
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
    }
}
