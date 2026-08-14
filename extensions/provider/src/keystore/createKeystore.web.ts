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

import {
    createDefaultShims,
    createKeyStore,
} from '@algorandfoundation/keystore-core'
import { createIndexedDBDriver } from '@algorandfoundation/keystore-web'
import type { ReactNativeKeyStore } from '@algorandfoundation/react-native-keystore'
import type { PeraKeystoreDeps } from './createKeystore'

/**
 * Web build of {@link createPeraKeystore}, picked by Metro's `.web.ts`
 * resolution for the browser extension.
 *
 * The engine is composed here rather than through `createWebKeyStore` for one
 * reason: that wrapper types `shims` as a resolved array, while the core
 * orchestrator it forwards to also accepts a thunk. The thunk matters — the
 * default shims dynamically import WASM `falcon-1024`, XHD and dp256, and the
 * provider singleton builds this at module scope, so resolving them eagerly
 * would mean awaiting three WASM loads before any module using the provider can
 * finish evaluating. Everything else here is what `createWebKeyStore` does.
 *
 * `subtle` and `indexedDB` are deliberately left to the driver's own
 * `globalThis` defaults: in an extension this runs in the service worker and
 * the offscreen document alike, and both supply their own.
 *
 * The return type is the native one because `tsc` only ever resolves the
 * non-platform file; the two are structurally the same `KeyStore`, differing
 * only in the driver's per-operation context (`void` here, biometric prompt
 * options on device), which no caller in this repo passes.
 *
 * `deps.before` gates the driver's `ready` the same way `createReactNativeKeyStore`
 * gates the Keychain driver's — core's orchestrator awaits `driver.ready`
 * before hydrating, and that's the only hook available since `createKeyStore`
 * itself takes no such option. No Pera migration module registers on web
 * today (the `.web.ts` extension siblings are no-ops) and `keystore-web` ships
 * none either, so this currently gates nothing — it's here for the first web
 * revision that needs it.
 */
export const createPeraKeystore = (
    deps: PeraKeystoreDeps,
): ReactNativeKeyStore => {
    const driver = createIndexedDBDriver({ host: globalThis.crypto.subtle })
    const gatedDriver = deps.before
        ? { ...driver, ready: deps.before.then(() => driver.ready) }
        : driver

    return createKeyStore({
        driver: gatedDriver,
        store: deps.store,
        hooks: deps.hooks,
        shims: () => createDefaultShims(),
    }) as unknown as ReactNativeKeyStore
}
