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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { createKeyManagerStore } from '../store'
import { KeyPair, KeyType } from '../../models'
import { KeyValueStorageService } from '@perawallet/wallet-core-platform-integration'

describe('KeyManagerStore', () => {
    let mockStorage: KeyValueStorageService

    beforeEach(() => {
        // Reset the singleton store before each test if necessary,
        // although here we are testing createKeyManagerStore specifically or the hook.
        // If we test the exported useKeyManagerStore, we need to be careful with state persistence.
        // Ideally we verify the store logic mainly via a fresh store creation or resetting the existing one.

        mockStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
            getAllKeys: vi.fn(),
            multiGet: vi.fn(),
            multiSet: vi.fn(),
            multiRemove: vi.fn(),
        } as unknown as KeyValueStorageService
    })

    it('should initialize with empty keys', () => {
        const useStore = createKeyManagerStore(mockStorage)
        const { keys } = useStore.getState()
        expect(keys.size).toBe(0)
    })

    it('should get a key', () => {
        const useStore = createKeyManagerStore(mockStorage)
        const key: KeyPair = {
            id: '123',
            privateDataStorageKey: 'path/to/key',
            publicKey: 'public-key',
            createdAt: new Date(),
            type: KeyType.HDWalletDerivedKey,
        }

        act(() => {
            useStore.getState().addKey(key)
        })

        expect(useStore.getState().keys.size).toBe(1)

        expect(useStore.getState().getKey('123')).toEqual(key)
    })

    it('should remove an expired key', () => {
        const useStore = createKeyManagerStore(mockStorage)
        const key: KeyPair = {
            id: '123',
            privateDataStorageKey: 'path/to/key',
            publicKey: 'public-key',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() - 1000),
            type: KeyType.HDWalletDerivedKey,
        }

        act(() => {
            useStore.getState().addKey(key)
        })

        expect(useStore.getState().keys.size).toBe(1)

        expect(useStore.getState().getKey('123')).toBeNull()

        expect(useStore.getState().keys.size).toBe(0)
    })

    it('should add a key', () => {
        const useStore = createKeyManagerStore(mockStorage)
        const key: KeyPair = {
            id: '123',
            privateDataStorageKey: 'path/to/key',
            publicKey: 'public-key',
            createdAt: new Date(),
            type: KeyType.HDWalletDerivedKey,
        }

        act(() => {
            useStore.getState().addKey(key)
        })

        const { keys, getKey } = useStore.getState()
        expect(keys.size).toBe(1)
        expect(keys.get('123')).toEqual(key)
        expect(getKey('123')).toEqual(key)
    })

    it('should remove a key', () => {
        const useStore = createKeyManagerStore(mockStorage)
        const key: KeyPair = {
            id: '123',
            privateDataStorageKey: 'path/to/key',
            publicKey: 'public-key',
            createdAt: new Date(),
            type: KeyType.HDWalletDerivedKey,
        }

        act(() => {
            useStore.getState().addKey(key)
        })

        expect(useStore.getState().keys.size).toBe(1)

        act(() => {
            useStore.getState().removeKey('123')
        })

        expect(useStore.getState().keys.size).toBe(0)
        expect(useStore.getState().getKey('123')).toBeNull()
    })

    it('should persist and rehydrate correctly', () => {
        // This tests the 'partialize' and 'onRehydrateStorage' logic effectively
        // We simulate what zustand persist middleware does

        const key: KeyPair = {
            id: '123',
            privateDataStorageKey: 'path/to/key',
            publicKey: 'public-key',
            createdAt: new Date(),
            type: KeyType.HDWalletDerivedKey,
        }

        const useStore = createKeyManagerStore(mockStorage)
        act(() => {
            useStore.getState().addKey(key)
        })

        // Verify partialize
        const persistedState = useStore.persist
            .getOptions()
            .partialize?.(useStore.getState()) as any
        expect(persistedState.keys).toBeInstanceOf(Array)
        expect(persistedState.keys).toHaveLength(1)
        expect(persistedState.keys[0]).toEqual(key)

        // Verify rehydrate
        // We need to trigger the onRehydrateStorage callback chain manually or simulate hydration
        // Since we can't easily access the internal hydrate function of the middleware without extensive mocking,
        // we can test the `rehydrateKeyManagerSlice` logic if it were exported, or trust that Zustand calls it.
        // Assuming we trust Zustand, we just check if the store data structure is correct after operations.
        // But we DO have custom logic in `onRehydrateStorage`:
        // keysState = rehydrateKeyManagerSlice(state)
        // Object.assign(state, keysState)

        // Let's manually invoke the rehydration logic if possible, or just verify the store behaves as expected
        // when we hypothetically reload. Since testing actual persistence storage interaction is lower value here (it mocks the storage),
        // we focus on the transformation logic.

        // However, we can inspect the options to call the onRehydrateStorage callback if we want to be thorough
        const onRehydrate = useStore.persist
            .getOptions()
            .onRehydrateStorage?.(useStore.getState())

        // Create a "raw" state as it would come from storage (Arrays instead of Maps)
        const rawStateFromStorage = {
            keys: [key],
        }

        if (onRehydrate) {
            onRehydrate(rawStateFromStorage as any, undefined)
        }

        // Now rawStateFromStorage should have been mutated to have a Map
        expect((rawStateFromStorage as any).keys).toBeInstanceOf(Map)
        expect((rawStateFromStorage as any).keys.get('123')).toEqual(key)
    })
})
