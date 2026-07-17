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

import type { PQSignatureProvider } from './types'
import { createWasmFalconProvider } from './wasmFalconProvider'

let cached: PQSignatureProvider | undefined

/**
 * Returns the active PQ signature provider. The React Native native provider
 * is wired in a later ticket (PQ-020); until then, and in node/test
 * environments, the WASM provider is used.
 */
export const getPQProvider = (): PQSignatureProvider => {
    if (!cached) {
        cached = createWasmFalconProvider()
    }
    return cached
}
