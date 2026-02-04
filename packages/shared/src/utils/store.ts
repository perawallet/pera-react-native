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
import { logger } from './logging'

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

export function createLazyStore<T extends StoreApi<unknown>>(name: string): LazyStore<T> {
    let store: UseBoundStore<T> | null = null
    let resetStateFn: (() => void) | null = null

    const useStore = ((selector: (state: ExtractState<T>) => unknown) => {
        if (!store) {
            throw new Error(`Zustand store ${name} used in useStore before initialization`)
        }
        return store(selector)
    }) as UseBoundStore<T>

    useStore.getState = () => {
        if (!store) {
            throw new Error(`Zustand store ${name} used in getState before initialization`)
        }
        return store.getState()
    }

    useStore.setState = (partial, replace) => {
        if (!store) {
            throw new Error(`Zustand store ${name} used in setState before initialization`)
        }
        store.setState(partial, replace as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    useStore.subscribe = listener => {
        if (!store) {
            throw new Error(`Zustand store ${name} used in subscribe before initialization`)
        }
        return store.subscribe(listener)
    }

    return {
        useStore,
        init(realStore, resetState) {
            logger.debug(`Initializing zustand store ${name}`)
            store = realStore
            resetStateFn = resetState
            logger.debug(`Store ${name} initialized: ${!!store}`)
        },
        clear() {
            if (store) {
                logger.debug(`Clearing store ${name}`)
                const persistStore = store as unknown as PersistApi
                persistStore.persist?.clearStorage()
                resetStateFn?.()
                logger.debug(`Store ${name} cleared`)
            }
        },
        getStore() {
            return store
        },
        _internal: { store },
    }
}
