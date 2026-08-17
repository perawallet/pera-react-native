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
 * Returns the active PQ signature provider (memoized).
 *
 * This is the off-device implementation (WASM Falcon-1024), used by node,
 * vitest and the web/extension build. On iOS and Android, Metro resolves
 * `getPQProvider.native.ts` instead, which returns the native Nitro provider.
 * The platform choice is therefore made by the bundler, not by a runtime
 * check — both files export the same name and satisfy the same pure
 * {@link PQSignatureProvider} contract, so no consumer branches on platform.
 *
 * Note the inverted convention: elsewhere in this repo the base file is the
 * native one and `.web.*` overrides it. Here the base must be the off-device
 * provider, because `getPQProvider` is reached through a RELATIVE import
 * inside `packages/kms` — a vitest `alias` entry matches specifiers and
 * cannot redirect it, so node/test resolution has to be correct by default.
 */
export const getPQProvider = (): PQSignatureProvider => {
    if (!cached) {
        cached = createWasmFalconProvider()
    }
    return cached
}
