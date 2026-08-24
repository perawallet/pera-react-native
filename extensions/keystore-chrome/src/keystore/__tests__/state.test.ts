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
// Ported from @algorandfoundation/keystore@1.0.0-canary.17 store.test.ts
// Portions Copyright Algorand Foundation, Apache-2.0
//
// Only the store-management cases are ported (addKey, removeKey, setStatus,
// clearKeyStore, getKey, initializeKeyStore). The crypto entry points
// (encrypt/decrypt/verify/sign) live in upstream's store.ts but belong to a
// later vendoring task.

import { Store } from '@tanstack/store'
import { describe, expect, it } from 'vitest'
import {
    addKey,
    clearKeyStore,
    getKey,
    initializeKeyStore,
    removeKey,
    setStatus,
} from '../state'
import type { KeyStoreState } from '../types'

describe('state.ts', () => {
    const createStore = () =>
        new Store<KeyStoreState>({
            keys: [],
            status: 'idle',
        })

    it('addKey adds a key to the store', () => {
        const store = createStore()
        const key = { id: 'k1', type: 'ecc', algorithm: 'EdDSA' } as any
        addKey(store, key)
        expect(store.state.keys).toContain(key)
    })

    it('removeKey removes a key by id', () => {
        const store = createStore()
        const key = { id: 'k1' } as any
        store.setState(() => ({ keys: [key], status: 'idle' }))
        removeKey({ store, keyId: 'k1' })
        expect(store.state.keys).not.toContain(key)
    })

    it('setStatus updates the status', () => {
        const store = createStore()
        setStatus({ store, status: 'busy' })
        expect(store.state.status).toBe('busy')
    })

    it('clearKeyStore clears keys and resets status', () => {
        const store = createStore()
        store.setState(() => ({ keys: [{ id: 'k1' } as any], status: 'busy' }))
        clearKeyStore({ store })
        expect(store.state.keys).toEqual([])
        expect(store.state.status).toBe('idle')
    })

    it('getKey retrieves a key by id', () => {
        const store = createStore()
        const key = { id: 'k1' } as any
        store.setState(() => ({ keys: [key], status: 'idle' }))
        expect(getKey({ store, id: 'k1' })).toBe(key)
        expect(getKey({ store, id: 'non-existent' })).toBeUndefined()
    })

    it('initializeKeyStore sets keys and status', () => {
        const store = createStore()
        const keys = [{ id: 'k1' } as any]
        initializeKeyStore({ store, keys })
        expect(store.state.keys).toBe(keys)
        expect(store.state.status).toBe('idle')
    })
})
