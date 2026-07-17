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
import { createWasmFalconProvider } from './wasmFalconProvider'

let cached: PQSignatureProvider | undefined

/**
 * Whether we are executing inside the React Native runtime. React Native
 * defines `navigator.product === 'ReactNative'`; node and jsdom (tests) do
 * not, so this stays `false` there and the WASM provider is selected. The
 * `typeof` guard avoids a ReferenceError under node versions without a global
 * `navigator`.
 */
const isReactNative = (): boolean =>
    typeof navigator !== 'undefined' && navigator.product === 'ReactNative'

/**
 * Returns the active PQ signature provider (memoized). On-device (React
 * Native) this is the native nitro Falcon-1024 module; in node/test
 * environments it is the WASM provider. Both satisfy the same pure
 * {@link PQSignatureProvider} contract.
 */
export const getPQProvider = (): PQSignatureProvider => {
    if (!cached) {
        cached = isReactNative()
            ? createRNFalconProvider()
            : createWasmFalconProvider()
    }
    return cached
}
