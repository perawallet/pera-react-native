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

// Guards a Hermes startup crash: falcon-wasm's entries instantiate the
// embedded Emscripten module at module scope (and its CJS build reads
// `__filename`), neither of which Hermes can evaluate — no `WebAssembly`, no
// `__filename`. The WASM provider is only selected off-device, but an eagerly
// evaluated import anywhere in the pq barrel still runs that glue on device at
// startup. The mock throws on evaluation, so any import-time evaluation fails
// this test.
//
// Blind spot: vi.mock intercepts ESM imports, not a bare CJS `require` at module
// scope — that shape would stay green here and still crash on device.
vi.mock('@algorandfoundation/falcon-wasm', () => {
    throw new Error(
        '@algorandfoundation/falcon-wasm was evaluated at import time — on ' +
            'device this crashes Hermes, which has no WebAssembly and no ' +
            '__filename. Load it lazily inside createWasmFalconProvider ' +
            'instead.',
    )
})

// Same guard for the native module, but a narrower claim than falcon-wasm's.
// `@joe-p/react-native-falcon`'s module scope instantiates the native
// HybridObject. Off device that has nothing to bind to, so it must stay behind
// `falconModule.ts`'s lazy `require` — which is what this mock pins, since
// vitest resolves `./falconModule` to that off-device file.
//
// It is NOT a general "eager import crashes at startup" rule. On device the
// accessor is `falconModule.native.ts` and imports EAGERLY by necessity (a
// rolldown-shimmed `require` is invisible to Metro's dependency collector), and
// instantiating the HybridObject at bundle-eval time is fine there because the
// module is linked in — verified across 25 cold starts on a physical
// SM-S901E/Android 16. `falconModuleNative.spec.ts` pins that side of it.
// Unlike falcon-wasm's Hermes crash, this one is environmental.
vi.mock('@joe-p/react-native-falcon', () => {
    throw new Error(
        '@joe-p/react-native-falcon was evaluated at import time on the ' +
            'OFF-device path — its module scope instantiates the native ' +
            'HybridObject, which has nothing to bind to under node/vitest or ' +
            'in the web build. Keep falconModule.ts lazy; only the .native ' +
            'variant may import it eagerly.',
    )
})

describe('PQ provider import-time side effects', () => {
    test('importing the pq barrel graph does not evaluate falcon-wasm', async () => {
        const { getPQProvider } = await import('../index')
        expect(getPQProvider).toBeTypeOf('function')
    })

    test('importing the native entry point does not evaluate the native Falcon module', async () => {
        const { getPQProvider } = await import('../getPQProvider.native')
        expect(getPQProvider).toBeTypeOf('function')
    })
})
