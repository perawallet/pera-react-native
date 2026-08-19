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

import { describe, expect, it, vi } from 'vitest'

vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))

vi.mock('@algorandfoundation/react-native-keystore', () => ({
    createReactNativeKeyStore: vi.fn(opts => ({
        ...opts,
        ready: Promise.resolve(),
    })),
}))

import { Store } from '@tanstack/store'
import Hook from 'before-after-hook'
import type { KeyStoreState } from '@algorandfoundation/keystore-core'
import { createPeraKeystore } from '../createKeystore'

const deps = () => ({
    store: new Store<KeyStoreState>({ keys: [], status: 'idle' }),
    hooks: new Hook.Collection(),
})

describe('createPeraKeystore', () => {
    // React Native has no global SubtleCrypto; canary.14 requires one to be
    // injected or every material operation fails at runtime.
    it('injects a Subtle implementation', () => {
        expect(createPeraKeystore(deps())).toHaveProperty('subtle')
    })

    // `falcon` must stay unset: the engine then loads
    // `@joe-p/react-native-falcon` itself and degrades gracefully off-device.
    // Passing an explicit binding would make bundles without the native module
    // fail at construction instead.
    it('leaves the Falcon binding to the engine', () => {
        expect(createPeraKeystore(deps())).not.toHaveProperty('falcon')
    })

    // Two consequences, both silent. `createDefaultShims` wraps the bundled
    // dp256 binding in `withSubtleDerivedMainKey` only when the caller passes
    // no `dp256` override (keystore-core@1.0.0-canary.3 defaults.js:169), so an
    // explicit stack is how the passkey main key ends up on the pure-JS
    // 210,000-iteration PBKDF2; and `engine.js:205` only auto-loads Falcon when
    // `shims` is absent. See `passkeyMainKeyDerivation.spec.ts`.
    it('leaves the shim stack to the engine', () => {
        expect(createPeraKeystore(deps())).not.toHaveProperty('shims')
    })

    it('wires the caller-owned store and hooks rather than fresh ones', () => {
        const d = deps()

        const keystore = createPeraKeystore(d) as unknown as {
            store: unknown
            hooks: unknown
        }

        expect(keystore.store).toBe(d.store)
        expect(keystore.hooks).toBe(d.hooks)
    })
})
