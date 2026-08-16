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

import { createRNFalconProvider } from './rnFalconProvider'
import type { PQSignatureProvider } from './types'

let cached: PQSignatureProvider | undefined

/**
 * On-device (iOS / Android) PQ signature provider: the native Nitro
 * Falcon-1024 module. Metro resolves this file in place of
 * `getPQProvider.ts` for the `ios` and `android` platforms via its standard
 * `.native.*` platform-extension resolution, so nothing imports it
 * explicitly and no runtime platform check is needed.
 *
 * `createRNFalconProvider` itself lazily `require()`s
 * `@joe-p/react-native-falcon`, because that module's scope instantiates the
 * native HybridObject. That laziness is about import side effects, not about
 * platform selection, so it remains necessary here.
 *
 * Deliberately NOT replaced by upstream's `loadDefaultFalconBinding`
 * (`@algorandfoundation/react-native-keystore@1.0.0-canary.19`,
 * `dist/falcon.js:72`, called from `dist/engine.js:207`): that builds the
 * keystore's own shim set, returning an async `Falcon1024Binding` that is
 * `undefined` off-device with no WASM fallback. It cannot supply the scheme id
 * and `generateKeypairFromSeed` that `useKMS.getPQSigningInfo` and the quantum
 * fixtures need on every platform, including node and vitest.
 */
export const getPQProvider = (): PQSignatureProvider => {
    if (!cached) {
        cached = createRNFalconProvider()
    }
    return cached
}
