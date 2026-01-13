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

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
    KeyValueStorageService,
    useKeyValueStorageService,
} from '@perawallet/wallet-core-platform-integration'
import type { KeyManagerState, KeyPair } from '../models'
import {
    createLazyStore,
    logger,
    type WithPersist,
} from '@perawallet/wallet-core-shared'

const lazy = createLazyStore<WithPersist<StoreApi<KeyManagerState>, unknown>>()

export const useKeyManagerStore: UseBoundStore<
    WithPersist<StoreApi<KeyManagerState>, unknown>
> = lazy.useStore

const objectToKeyMap = (object: KeyPair[]): Map<string, KeyPair> => {
    const map = new Map<string, KeyPair>()
    object?.forEach(keyPair => {
        map.set(keyPair.id ?? '', keyPair)
    })
    return map
}

// Rehydration function to convert persisted object back to Map
const rehydrateKeyManagerSlice = (
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    persistedState: any,
): Partial<KeyManagerState> => {
    if (persistedState) {
        return {
            ...persistedState,
            keys: objectToKeyMap(persistedState.keys),
        }
    }
    return persistedState
}

export const createKeyManagerStore = (storage: KeyValueStorageService) =>
    create<KeyManagerState>()(
        persist(
            (set, get) => ({
                keys: new Map(),
                getKey: (id: string) => {
                    const key = get().keys.get(id)
                    if (!key) {
                        return null
                    }

                    if (key.expiresAt && Date.now() > key.expiresAt.getTime()) {
                        get().removeKey(id)
                        return null
                    }

                    return key
                },
                addKey: (key: KeyPair) => {
                    const keys = get().keys
                    keys.set(key.id ?? '', key)
                    set({ keys })
                },
                removeKey: (id: string) => {
                    const keys = get().keys
                    keys.delete(id)
                    set({ keys })
                },
            }),
            {
                name: 'key-manager-store',
                storage: createJSONStorage(() => storage),
                version: 1,
                partialize: state => ({
                    keys: Array.from(state.keys.values()),
                }),
                onRehydrateStorage: () => state => {
                    if (state) {
                        // Rehydrate device slice to convert deviceIDs back to Map
                        const keysState = rehydrateKeyManagerSlice(state)
                        Object.assign(state, keysState)
                    }
                },
            },
        ),
    )

export const initKeyManagerStore = () => {
    logger.debug('Initializing key manager store')
    const storage = useKeyValueStorageService()
    const realStore = createKeyManagerStore(storage)
    lazy.init(realStore)
    logger.debug('Key manager store initialized')
}
