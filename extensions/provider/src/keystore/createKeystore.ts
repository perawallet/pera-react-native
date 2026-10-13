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

import { subtle } from 'react-native-quick-crypto'
import {
    createDefaultShims,
    createReactNativeKeyStore,
    loadDefaultFalconBinding,
} from '@algorandfoundation/react-native-keystore'
import type { ReactNativeKeyStore } from '@algorandfoundation/react-native-keystore'
import type { KeyStoreState } from '@algorandfoundation/keystore-core'
import type { Store } from '@tanstack/store'
import type { HookCollection } from 'before-after-hook'
import { secp256k1Shim } from './shims/secp256k1'

export type PeraKeystoreDeps = {
    /** The provider's reactive store — never a fresh one, or kms reads stale state. */
    store: Store<KeyStoreState>
    /** How `WithKeyStore` threads interception; kms routes `algo25` signing through it. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hooks: HookCollection<any>
    /**
     * Migrations must finish before core hydrates the reactive store from the
     * `k/` bucket, or it mirrors pre-migration data. `WithKeyStore` wires this
     * itself — but only when it builds the engine, and we inject a concrete one
     * through `options.api.keystore`, so we pass it here instead.
     */
    before?: Promise<unknown>
}

/**
 * React Native has no global `SubtleCrypto`, so the engine requires one to be
 * supplied. The shim list rebuilds exactly the engine's own default set, with
 * Falcon loaded from `@joe-p/react-native-falcon` and left out when the native
 * module is unavailable (which keeps off-device bundles working), and adds
 * secp256k1 on top.
 */
export const createPeraKeystore = (
    deps: PeraKeystoreDeps,
): ReactNativeKeyStore =>
    createReactNativeKeyStore({
        store: deps.store,
        hooks: deps.hooks,
        subtle: subtle as unknown as SubtleCrypto,
        before: deps.before,
        shims: async () => [
            ...(await createDefaultShims({
                falcon: await loadDefaultFalconBinding(),
            })),
            secp256k1Shim(),
        ],
    })
