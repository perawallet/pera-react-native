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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Key, KeyStoreState } from '@algorandfoundation/keystore-core'

// Minimal fake matching the slice of TanStack Store API we use:
// `state` getter, `setState(updater)`, `subscribe(listener)` returning
// `{ unsubscribe }`. Avoids pulling @tanstack/store into kms's deps just for
// this test.
type FakeStore = {
    state: KeyStoreState
    setState: (updater: (prev: KeyStoreState) => KeyStoreState) => void
    subscribe: (listener: () => void) => { unsubscribe: () => void }
}

const makeFakeStore = (initial: KeyStoreState): FakeStore => {
    let state = initial
    const listeners = new Set<() => void>()
    return {
        get state() {
            return state
        },
        setState(updater) {
            state = updater(state)
            for (const l of listeners) l()
        },
        subscribe(listener) {
            listeners.add(listener)
            return { unsubscribe: () => listeners.delete(listener) }
        },
    }
}

let keystoreStore: FakeStore

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => keystoreStore,
}))

import { useKeystoreKeys, useKeystoreKey } from '../useKeystoreState'

const makeKey = (id: string, type: string = 'hd-root-key'): Key =>
    ({
        id,
        type,
        algorithm: 'raw',
        extractable: true,
    }) as Key

describe('useKeystoreState', () => {
    beforeEach(() => {
        keystoreStore = makeFakeStore({ keys: [], status: 'idle' })
    })

    test('useKeystoreKeys returns the current keys array from the store', () => {
        keystoreStore.setState(s => ({
            ...s,
            keys: [makeKey('a'), makeKey('b')],
        }))

        const { result } = renderHook(() => useKeystoreKeys())

        expect(result.current.map(k => k.id)).toEqual(['a', 'b'])
    })

    test('useKeystoreKeys re-renders when the store updates', () => {
        const { result } = renderHook(() => useKeystoreKeys())
        expect(result.current).toEqual([])

        act(() => {
            keystoreStore.setState(s => ({ ...s, keys: [makeKey('a')] }))
        })

        expect(result.current.map(k => k.id)).toEqual(['a'])

        act(() => {
            keystoreStore.setState(s => ({
                ...s,
                keys: [...s.keys, makeKey('b')],
            }))
        })

        expect(result.current.map(k => k.id)).toEqual(['a', 'b'])
    })

    test('useKeystoreKey returns the matching Key', () => {
        keystoreStore.setState(s => ({
            ...s,
            keys: [makeKey('a'), makeKey('b')],
        }))

        const { result } = renderHook(() => useKeystoreKey('b'))
        expect(result.current?.id).toBe('b')
    })

    test('useKeystoreKey returns undefined when id is missing or absent', () => {
        keystoreStore.setState(s => ({ ...s, keys: [makeKey('a')] }))

        const { result: missing } = renderHook(() => useKeystoreKey('z'))
        expect(missing.current).toBeUndefined()

        const { result: noId } = renderHook(() => useKeystoreKey(undefined))
        expect(noId.current).toBeUndefined()
    })
})
