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
import { getFalconModule } from './falconModule'
import type { PQSignatureProvider } from './types'

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
 * That selection does not make reaching the native module eager, though: the
 * pq barrel (`index.ts`) re-exports `createRNFalconProvider` independent of
 * which `getPQProvider` variant the bundler picked, so node/vitest still
 * import this file. How the module is obtained is therefore delegated to
 * `./falconModule`, whose off-device and `.native` variants differ in exactly
 * that respect — see both for why the on-device one must import statically.
 */
export const createRNFalconProvider = (): PQSignatureProvider => {
    const FalconModule = getFalconModule()

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
