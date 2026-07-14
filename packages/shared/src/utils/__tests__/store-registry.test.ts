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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    registerStore,
    clearAllStores,
    getStoreRegistry,
    resetStoreRegistry,
} from '../store-registry'

vi.mock('../logging', () => ({
    logger: { debug: vi.fn() },
}))

describe('store-registry', () => {
    beforeEach(() => {
        resetStoreRegistry()
    })

    it('registers and clears all stores', () => {
        const store1 = {
            name: 'store-1',
            clearStorage: vi.fn(),
            resetState: vi.fn(),
        }
        const store2 = {
            name: 'store-2',
            clearStorage: vi.fn(),
            resetState: vi.fn(),
        }
        registerStore(store1)
        registerStore(store2)

        clearAllStores()

        expect(store1.clearStorage).toHaveBeenCalledTimes(1)
        expect(store1.resetState).toHaveBeenCalledTimes(1)
        expect(store2.clearStorage).toHaveBeenCalledTimes(1)
        expect(store2.resetState).toHaveBeenCalledTimes(1)
    })

    it('skips stores listed in options.skip', () => {
        const store1 = {
            name: 'accounts-store',
            clearStorage: vi.fn(),
            resetState: vi.fn(),
        }
        const store2 = {
            name: 'settings-store',
            clearStorage: vi.fn(),
            resetState: vi.fn(),
        }
        registerStore(store1)
        registerStore(store2)

        clearAllStores({ skip: ['accounts-store'] })

        expect(store1.clearStorage).not.toHaveBeenCalled()
        expect(store1.resetState).not.toHaveBeenCalled()
        expect(store2.clearStorage).toHaveBeenCalledTimes(1)
        expect(store2.resetState).toHaveBeenCalledTimes(1)
    })

    it('returns registered stores via getStoreRegistry', () => {
        const store = {
            name: 'test-store',
            clearStorage: vi.fn(),
            resetState: vi.fn(),
        }
        registerStore(store)

        const registry = getStoreRegistry()

        expect(registry).toHaveLength(1)
        expect(registry[0].name).toBe('test-store')
    })
})
