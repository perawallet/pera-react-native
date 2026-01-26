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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { clearAssetsStore, createAssetsStore, initAssetsStore } from '../store'
import { useKeyValueStorageService } from '@perawallet/wallet-core-platform-integration'
const { mockLazy, mockRegistry } = vi.hoisted(() => ({
    mockLazy: {
        useStore: vi.fn(),
        init: vi.fn(),
        clear: vi.fn(),
    },
    mockRegistry: {
        register: vi.fn(),
    },
}))

// Mock dependencies
vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useKeyValueStorageService: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual('@perawallet/wallet-core-shared')
    return {
        ...actual,
        createLazyStore: vi.fn(() => mockLazy),
        DataStoreRegistry: mockRegistry,
        logger: {
            debug: vi.fn(),
        },
    }
})

describe('services/assets/store', () => {
    let store: any
    const mockStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    }

    beforeEach(() => {
        store = createAssetsStore(mockStorage as any)
        vi.clearAllMocks()
    })

    test('initializes with empty assetIDs', () => {
        expect(store.getState().assetIDs).toEqual([])
    })

    test('setAssetIDs updates assetIDs', () => {
        store.getState().setAssetIDs(['1', '2', '3'])
        expect(store.getState().assetIDs).toEqual(['1', '2', '3'])
    })

    test('resetState reverts to initial state', () => {
        store.getState().setAssetIDs(['1', '2', '3'])
        expect(store.getState().assetIDs).toHaveLength(3)

        store.getState().resetState()
        expect(store.getState().assetIDs).toEqual([])
    })

    describe('initialization and registration', () => {
        test('initAssetsStore initializes the lazy store', () => {
            ;(useKeyValueStorageService as any).mockReturnValue(mockStorage)

            initAssetsStore()

            expect(mockLazy.init).toHaveBeenCalled()
        })

        test('clearAssetsStore clears the lazy store', () => {
            clearAssetsStore()

            expect(mockLazy.clear).toHaveBeenCalled()
        })
    })

    describe('persistence', () => {
        test('store configuration', () => {
            expect(store.getState()).toHaveProperty('assetIDs')
            expect(store.getState()).toHaveProperty('setAssetIDs')
            expect(store.getState()).toHaveProperty('resetState')
        })
    })
})
