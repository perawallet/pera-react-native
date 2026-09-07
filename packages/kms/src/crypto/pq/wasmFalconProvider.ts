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

// SWAP: joe-p WASM Falcon-1024 (Seam A). Replace with an official PQ crypto lib
// alongside `rnFalconProvider.ts`; both `getPQProvider` factories change together.
import type { PQSignatureProvider } from './types'

/**
 * WASM Falcon-1024 signature provider for node/test environments.
 *
 * Provider selection is a build-time choice, not a runtime branch: Metro
 * resolves `getPQProvider.native.ts` (Nitro/on-device) in place of the base
 * `getPQProvider.ts` (this file's consumer) for the `ios`/`android`
 * platforms — there is no runtime check deciding between them, and on
 * device this file is no longer reachable through `getPQProvider.native.ts`'s
 * import graph at all.
 *
 * It is still reachable on-device, though: the pq barrel (`index.ts`)
 * re-exports `createWasmFalconProvider` directly, regardless of which
 * `getPQProvider` variant the bundler picked. So merely importing the barrel
 * pulls this file in on every platform, including on-device. Loaded lazily
 * via `require` (not a top-level `import`), mirroring
 * `createRNFalconProvider`: falcon-1024's CJS entry is Emscripten glue that
 * reads `__filename` at module scope, which Hermes/Metro never define, so
 * eager evaluation crashes the app at startup. The `require` only executes
 * when `createWasmFalconProvider` is actually called, not on import.
 * (`import type` above is erased at compile time and is safe.)
 */
export const createWasmFalconProvider = (): PQSignatureProvider => {
    const { generateKey, FALCON_DET1024_PUBKEY_SIZE } =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('falcon-1024') as typeof import('falcon-1024')

    return {
        scheme: 'falcon1024',
        publicKeyLength: FALCON_DET1024_PUBKEY_SIZE,
        generateKeypairFromSeed(seed) {
            const { publicKey, privateKey } = generateKey(seed)
            return { publicKey, secretKey: privateKey }
        },
    }
}
