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
import { gateWritesOnHydration } from '../hydration-gate'

type State = { count: number }

const STORE = 'store'

const createStorage = () => ({
    getItem: vi.fn((_key: string): string | null => '{"state":{"count":1}}'),
    setItem: vi.fn(),
    removeItem: vi.fn(),
})

describe('gateWritesOnHydration', () => {
    test('drops writes until a hydration has merged what storage held', () => {
        const storage = createStorage()
        const gated = gateWritesOnHydration<State>(STORE, () => storage)
        const kv = gated.storage()

        kv.setItem(STORE, '2')
        expect(storage.setItem).not.toHaveBeenCalled()

        kv.getItem(STORE)
        kv.setItem(STORE, '2')
        expect(storage.setItem).not.toHaveBeenCalled()

        expect(gated.merge!({ count: 1 }, { count: 0 })).toEqual({ count: 1 })
        kv.setItem(STORE, '2')
        expect(storage.setItem).toHaveBeenCalledWith(STORE, '2')
    })

    test('closes the gate again when the next hydration starts', () => {
        const storage = createStorage()
        const gated = gateWritesOnHydration<State>(STORE, () => storage)
        const kv = gated.storage()
        gated.merge!({ count: 1 }, { count: 0 })

        kv.getItem(STORE)
        kv.setItem(STORE, '3')

        expect(storage.setItem).not.toHaveBeenCalled()
    })

    test('passes writes to other keys through before hydration', () => {
        const storage = createStorage()
        const kv = gateWritesOnHydration<State>(STORE, () => storage).storage()

        kv.getItem(`${STORE}::quarantine`)
        kv.setItem(`${STORE}::quarantine`, '[]')

        expect(storage.setItem).toHaveBeenCalledWith(
            `${STORE}::quarantine`,
            '[]',
        )
    })

    test('passes removals through whether or not hydration ran', () => {
        const storage = createStorage()
        const kv = gateWritesOnHydration<State>(STORE, () => storage).storage()

        kv.removeItem(STORE)

        expect(storage.removeItem).toHaveBeenCalledWith(STORE)
    })
})
