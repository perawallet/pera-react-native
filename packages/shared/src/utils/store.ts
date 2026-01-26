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

import { UseBoundStore, StoreApi, ExtractState } from 'zustand'

export interface LazyStore<T extends StoreApi<unknown>> {
    useStore: UseBoundStore<T>
    init: (realStore: UseBoundStore<T>, resetState: () => void) => void
    clear: () => void
    getStore: () => UseBoundStore<T> | null
    _internal: { store: UseBoundStore<T> | null }
}

interface PersistApi {
    persist?: {
        clearStorage: () => void
    }
}

export function createLazyStore<T extends StoreApi<unknown>>(): LazyStore<T> {
    let store: UseBoundStore<T> | null = null
    let resetStateFn: (() => void) | null = null

    const useStore = ((selector: (state: ExtractState<T>) => unknown) => {
        if (!store) {
            throw new Error('Zustand store used before initialization')
        }
        return store(selector)
    }) as UseBoundStore<T>

    useStore.getState = () => {
        if (!store) {
            throw new Error('Zustand store used before initialization')
        }
        return store.getState()
    }

    useStore.setState = (partial, replace) => {
        if (!store) {
            throw new Error('Zustand store used before initialization')
        }
        store.setState(partial, replace as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    useStore.subscribe = listener => {
        if (!store) {
            throw new Error('Zustand store used before initialization')
        }
        return store.subscribe(listener)
    }

    return {
        useStore,
        init(realStore, resetState) {
            store = realStore
            resetStateFn = resetState
        },
        clear() {
            if (store) {
                const persistStore = store as unknown as PersistApi
                persistStore.persist?.clearStorage()
                resetStateFn?.()
            }
        },
        getStore() {
            return store
        },
        _internal: { store },
    }
}
