/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

// Web shim for react-native-nitro-modules.
// The real package calls installWorkletsSupport() at module-eval time which
// transitively requires react-native's NativeModules bridge (BatchedBridge)
// and throws __fbBatchedBridgeConfig in browser environments.
// Nitro hybrid objects are native-only; on web they must throw loudly when
// used so that feature-detection guards and error boundaries catch the failure
// rather than silently absorbing awaited calls that hang forever.
//
// Design: createHybridObject() SUCCEEDS (returns a stub object) because some
// native packages call it at module-evaluation scope to build a factory singleton
// (e.g. react-native-vision-camera-barcode-scanner). Throwing there would crash
// the bootstrap before any screen renders. Instead, the returned stub throws on
// every method call so that any real usage surfaces an error state rather than
// hanging silently (the absorb-all proxy failure mode).

function makeThrowingStub(name) {
    return new Proxy({}, {
        get(_t, prop) {
            // Allow introspection so feature-detection works.
            if (prop === Symbol.toPrimitive || prop === 'toString' || prop === 'valueOf') {
                return () => `[NitroStub:${name}]`
            }
            // Return a function that rejects (not throws synchronously) so that
            // module-scope calls wrapped in .catch() don't crash the bootstrap.
            // Awaited calls in screen code will surface as Promise rejections that
            // error boundaries and error states can handle — no silent hanging.
            return (..._args) =>
                Promise.reject(
                    new Error(`Nitro hybrid object '${name}' is unavailable on web (method: ${String(prop)})`),
                )
        },
    })
}

// NitroModules web stub — hybrid objects are native-only.
export const NitroModules = {
    createHybridObject(name) {
        // Returns a stub that throws on method calls (not at creation time, to
        // allow module-scope factory patterns to initialise without crashing).
        return makeThrowingStub(name)
    },
    createHybridObjectFromNativeView(name) {
        return makeThrowingStub(name)
    },
    box: () => { throw new Error('NitroModules.box() is unavailable on web') },
    unbox: () => { throw new Error('NitroModules.unbox() is unavailable on web') },
    isHybridObject: () => false,
}

export const isRuntimeAlive = () => false

// getHostComponent — returns null on web; native view components are unavailable.
export const getHostComponent = () => null

// Stub for hybrid object construction — callers must guard on isRuntimeAlive().
export const getHybridObjectConstructor = () => null

// Stub types/helpers (value exports that may be referenced by non-type imports).
export const HybridObject = null
export const AnyMap = null
