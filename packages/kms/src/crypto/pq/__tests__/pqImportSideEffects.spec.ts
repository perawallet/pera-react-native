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

// @vitest-environment node
import { describe, expect, test, vi } from 'vitest'

// Regression guard for the on-device startup crash "Property '__filename'
// doesn't exist": falcon-1024's CJS entry is Emscripten glue that reads
// `__filename` at module scope, which Hermes/Metro never define. The WASM
// provider is only ever *selected* off-device, but a static (or eagerly
// evaluated) import anywhere in the getPQProvider graph still evaluates that
// glue on device at app startup. This mock throws on evaluation, simulating
// the Hermes crash: if any module in the graph evaluates falcon-1024 at
// import time, the dynamic import below rejects and this test fails.
vi.mock('falcon-1024', () => {
    throw new Error(
        'falcon-1024 was evaluated at import time — on device this crashes ' +
            "Hermes with \"Property '__filename' doesn't exist\". Load it " +
            'lazily inside createWasmFalconProvider instead.',
    )
})

describe('PQ provider import-time side effects', () => {
    test('importing the getPQProvider graph does not evaluate falcon-1024', async () => {
        const { getPQProvider } = await import('../getPQProvider')
        expect(getPQProvider).toBeTypeOf('function')
    })
})
