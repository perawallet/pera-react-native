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

// SWAP: joe-p WASM Falcon-1024. Replace with the official PQ crypto lib per
// docs/QUANTUM_PQ_INTEGRATION.md (Seam A).
import type { PQSignatureProvider } from './types'

/**
 * WASM Falcon-1024 signature provider for node/test environments.
 *
 * Loaded lazily via `require` (not a top-level `import`), mirroring
 * `createRNFalconProvider`: merely importing this file — e.g. through
 * `getPQProvider`'s static import graph in the React Native bundle, which
 * never takes the WASM branch — must not evaluate falcon-1024. Its CJS entry
 * is Emscripten glue that reads `__filename` at module scope, which
 * Hermes/Metro never define, so eager evaluation crashes the app at startup.
 * The `require` only executes off-device, when `getPQProvider` selects this
 * provider. (`import type` above is erased at compile time and is safe.)
 */
export const createWasmFalconProvider = (): PQSignatureProvider => {
    const { generateKey, signCompressed, FALCON_DET1024_PUBKEY_SIZE } =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('falcon-1024') as typeof import('falcon-1024')

    return {
        scheme: 'falcon1024',
        publicKeyLength: FALCON_DET1024_PUBKEY_SIZE,
        generateKeypairFromSeed(seed) {
            const { publicKey, privateKey } = generateKey(seed)
            return { publicKey, secretKey: privateKey }
        },
        sign(secretKey, message) {
            return signCompressed(secretKey, message)
        },
    }
}
