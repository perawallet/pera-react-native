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

const falconBinding = vi.hoisted(() => ({ falcon: true }))
const defaultShim = vi.hoisted(() => () => ({}) as SubtleCrypto)

vi.mock('@algorandfoundation/react-native-keystore', () => ({
    createReactNativeKeyStore: vi.fn(opts => ({
        ...opts,
        ready: Promise.resolve(),
    })),
    loadDefaultFalconBinding: vi.fn(async () => falconBinding),
    createDefaultShims: vi.fn(async () => [defaultShim]),
}))

import { Store } from '@tanstack/store'
import Hook from 'before-after-hook'
import type {
    KeyStoreState,
    SubtleShim,
} from '@algorandfoundation/keystore-core'
import { createDefaultShims } from '@algorandfoundation/react-native-keystore'
import { createPeraKeystore } from '../createKeystore'
import { SECP256K1_ALGORITHM } from '../shims/secp256k1'

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

    // `falcon` stays unset at construction: a binding passed there would make
    // bundles without the native module fail immediately instead of when the
    // lazy shim list loads it.
    it('never passes a Falcon binding at construction', () => {
        expect(createPeraKeystore(deps())).not.toHaveProperty('falcon')
    })

    // The list must be exactly the engine's own default set plus secp256k1.
    // `createDefaultShims` wraps the bundled dp256 binding in
    // `withSubtleDerivedMainKey` only when no `dp256` override is passed, so
    // anything beyond `{ falcon }` would move the passkey main key onto the
    // pure-JS 210,000-iteration PBKDF2. See `passkeyMainKeyDerivation.spec.ts`.
    it('builds the default shims with the loaded Falcon binding, then adds secp256k1', async () => {
        const { shims } = createPeraKeystore(deps()) as unknown as {
            shims: () => Promise<SubtleShim[]>
        }

        const resolved = await shims()

        expect(createDefaultShims).toHaveBeenCalledWith({
            falcon: falconBinding,
        })
        expect(resolved).toHaveLength(2)
        expect(resolved[0]).toBe(defaultShim)
        expect(resolved[1].algorithm).toBe(SECP256K1_ALGORITHM)
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
