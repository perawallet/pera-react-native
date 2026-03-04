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
import { KeyPair, KeyType } from '../../models'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: () => {
            const store = new Map<string, string>()
            return {
                getItem: (key: string) => store.get(key) ?? null,
                setItem: (key: string, value: string) => {
                    store.set(key, value)
                },
                removeItem: (key: string) => {
                    store.delete(key)
                },
            }
        },
    }
})

describe('KeyManagerStore', () => {
    let useKeyManagerStore: typeof import('../store').useKeyManagerStore

    beforeEach(async () => {
        vi.resetModules()
        const module = await import('../store')
        useKeyManagerStore = module.useKeyManagerStore
    })

    it('should initialize with empty keys', () => {
        const { keys } = useKeyManagerStore.getState()
        expect(keys.size).toBe(0)
    })

    it('should get a key', () => {
        const key: KeyPair = {
            id: '123',
            privateDataStorageKey: 'path/to/key',
            publicKey: 'public-key',
            createdAt: new Date(),
            type: KeyType.HDWalletDerivedKey,
        }

        act(() => {
            useKeyManagerStore.getState().addKey(key)
        })

        expect(useKeyManagerStore.getState().keys.size).toBe(1)

        expect(useKeyManagerStore.getState().getKey('123')).toEqual(key)
    })

    it('should remove an expired key', () => {
        const key: KeyPair = {
            id: '123',
            privateDataStorageKey: 'path/to/key',
            publicKey: 'public-key',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() - 1000),
            type: KeyType.HDWalletDerivedKey,
        }

        act(() => {
            useKeyManagerStore.getState().addKey(key)
        })

        expect(useKeyManagerStore.getState().keys.size).toBe(1)

        expect(useKeyManagerStore.getState().getKey('123')).toBeNull()

        expect(useKeyManagerStore.getState().keys.size).toBe(0)
    })

    it('should add a key', () => {
        const key: KeyPair = {
            id: '123',
            privateDataStorageKey: 'path/to/key',
            publicKey: 'public-key',
            createdAt: new Date(),
            type: KeyType.HDWalletDerivedKey,
        }

        act(() => {
            useKeyManagerStore.getState().addKey(key)
        })

        const { keys, getKey } = useKeyManagerStore.getState()
        expect(keys.size).toBe(1)
        expect(keys.get('123')).toEqual(key)
        expect(getKey('123')).toEqual(key)
    })

    it('should remove a key', () => {
        const key: KeyPair = {
            id: '123',
            privateDataStorageKey: 'path/to/key',
            publicKey: 'public-key',
            createdAt: new Date(),
            type: KeyType.HDWalletDerivedKey,
        }

        act(() => {
            useKeyManagerStore.getState().addKey(key)
        })

        expect(useKeyManagerStore.getState().keys.size).toBe(1)

        act(() => {
            useKeyManagerStore.getState().removeKey('123')
        })

        expect(useKeyManagerStore.getState().keys.size).toBe(0)
        expect(useKeyManagerStore.getState().getKey('123')).toBeNull()
    })

    it('should persist and rehydrate correctly', () => {
        const key: KeyPair = {
            id: '123',
            privateDataStorageKey: 'path/to/key',
            publicKey: 'public-key',
            createdAt: new Date(),
            type: KeyType.HDWalletDerivedKey,
        }

        act(() => {
            useKeyManagerStore.getState().addKey(key)
        })

        // Verify partialize
        const persistedState = useKeyManagerStore.persist
            .getOptions()
            .partialize?.(useKeyManagerStore.getState()) as any
        expect(persistedState.keys).toBeInstanceOf(Array)
        expect(persistedState.keys).toHaveLength(1)
        expect(persistedState.keys[0]).toEqual(key)

        const onRehydrate = useKeyManagerStore.persist
            .getOptions()
            .onRehydrateStorage?.(useKeyManagerStore.getState())

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
