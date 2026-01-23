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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { DataStoreRegistry } from '../store-registry'

describe('utils/store-registry', () => {
    beforeEach(() => {
        DataStoreRegistry.reset()
    })

    describe('register', () => {
        test('registers a store successfully', () => {
            const mockStore = {
                name: 'test-store',
                init: vi.fn(),
                clear: vi.fn(),
            }

            DataStoreRegistry.register(mockStore)

            expect(DataStoreRegistry.getRegisteredStores()).toContain(
                'test-store',
            )
        })

        test('does not register duplicate stores', () => {
            const mockStore = {
                name: 'test-store',
                init: vi.fn(),
                clear: vi.fn(),
            }

            DataStoreRegistry.register(mockStore)
            DataStoreRegistry.register(mockStore)

            expect(
                DataStoreRegistry.getRegisteredStores().filter(
                    name => name === 'test-store',
                ),
            ).toHaveLength(1)
        })
    })

    describe('initializeAll', () => {
        test('calls init on all registered stores', async () => {
            const mockStore1 = {
                name: 'test-store-1',
                init: vi.fn(),
                clear: vi.fn(),
            }
            const mockStore2 = {
                name: 'test-store-2',
                init: vi.fn(),
                clear: vi.fn(),
            }

            DataStoreRegistry.register(mockStore1)
            DataStoreRegistry.register(mockStore2)

            await DataStoreRegistry.initializeAll()

            expect(mockStore1.init).toHaveBeenCalledTimes(1)
            expect(mockStore2.init).toHaveBeenCalledTimes(1)
        })

        test('does not reinitialize if already initialized', async () => {
            const mockStore = {
                name: 'test-store',
                init: vi.fn(),
                clear: vi.fn(),
            }

            DataStoreRegistry.register(mockStore)

            await DataStoreRegistry.initializeAll()
            await DataStoreRegistry.initializeAll()

            expect(mockStore.init).toHaveBeenCalledTimes(1)
        })

        test('sets initialized flag after initialization', async () => {
            const mockStore = {
                name: 'test-store',
                init: vi.fn(),
                clear: vi.fn(),
            }

            DataStoreRegistry.register(mockStore)

            expect(DataStoreRegistry.isInitialized()).toBe(false)
            await DataStoreRegistry.initializeAll()
            expect(DataStoreRegistry.isInitialized()).toBe(true)
        })
    })

    describe('clearAll', () => {
        test('calls clear on all registered stores', async () => {
            const mockStore1 = {
                name: 'test-store-1',
                init: vi.fn(),
                clear: vi.fn(),
            }
            const mockStore2 = {
                name: 'test-store-2',
                init: vi.fn(),
                clear: vi.fn(),
            }

            DataStoreRegistry.register(mockStore1)
            DataStoreRegistry.register(mockStore2)

            await DataStoreRegistry.clearAll()

            expect(mockStore1.clear).toHaveBeenCalledTimes(1)
            expect(mockStore2.clear).toHaveBeenCalledTimes(1)
        })
    })

    describe('getRegisteredStores', () => {
        test('returns empty array when no stores registered', () => {
            expect(DataStoreRegistry.getRegisteredStores()).toEqual([])
        })

        test('returns all registered store names', () => {
            DataStoreRegistry.register({
                name: 'store-a',
                init: vi.fn(),
                clear: vi.fn(),
            })
            DataStoreRegistry.register({
                name: 'store-b',
                init: vi.fn(),
                clear: vi.fn(),
            })

            const stores = DataStoreRegistry.getRegisteredStores()

            expect(stores).toContain('store-a')
            expect(stores).toContain('store-b')
            expect(stores).toHaveLength(2)
        })
    })

    describe('reset', () => {
        test('clears all registered stores', () => {
            DataStoreRegistry.register({
                name: 'test-store',
                init: vi.fn(),
                clear: vi.fn(),
            })

            DataStoreRegistry.reset()

            expect(DataStoreRegistry.getRegisteredStores()).toEqual([])
        })

        test('resets initialized flag', async () => {
            DataStoreRegistry.register({
                name: 'test-store',
                init: vi.fn(),
                clear: vi.fn(),
            })

            await DataStoreRegistry.initializeAll()
            expect(DataStoreRegistry.isInitialized()).toBe(true)

            DataStoreRegistry.reset()
            expect(DataStoreRegistry.isInitialized()).toBe(false)
        })
    })
})
