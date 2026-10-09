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

import { describe, expect, test, vi } from 'vitest'
import type { PersistStorage } from 'zustand/middleware'
import { gateWritesOnHydration } from '../hydration-gate'

type State = { count: number }

const createStorage = () =>
    ({
        getItem: vi.fn(() => ({ state: { count: 1 }, version: 0 })),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    }) satisfies PersistStorage<State>

describe('gateWritesOnHydration', () => {
    test('drops writes until a hydration has merged what storage held', () => {
        const storage = createStorage()
        const gated = gateWritesOnHydration<State, State>(storage)
        const value = { state: { count: 2 }, version: 0 }

        gated.storage!.setItem('store', value)
        expect(storage.setItem).not.toHaveBeenCalled()

        gated.storage!.getItem('store')
        gated.storage!.setItem('store', value)
        expect(storage.setItem).not.toHaveBeenCalled()

        expect(gated.merge!({ count: 1 }, { count: 0 })).toEqual({ count: 1 })
        gated.storage!.setItem('store', value)
        expect(storage.setItem).toHaveBeenCalledWith('store', value)
    })

    test('closes the gate again when the next hydration starts', () => {
        const storage = createStorage()
        const gated = gateWritesOnHydration<State, State>(storage)
        gated.merge!({ count: 1 }, { count: 0 })

        gated.storage!.getItem('store')
        gated.storage!.setItem('store', { state: { count: 3 }, version: 0 })

        expect(storage.setItem).not.toHaveBeenCalled()
    })

    test('passes removals through whether or not hydration ran', () => {
        const storage = createStorage()
        const gated = gateWritesOnHydration<State, State>(storage)

        gated.storage!.removeItem('store')

        expect(storage.removeItem).toHaveBeenCalledWith('store')
    })

    test('leaves storage unset when the store has none', () => {
        expect(
            gateWritesOnHydration<State, State>(undefined).storage,
        ).toBeUndefined()
    })
})
