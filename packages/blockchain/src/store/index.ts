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
import type { BlockchainStore, SignRequest } from '../models'
import {
    createLazyStore,
    debugLog,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { v7 as uuidv7 } from 'uuid'

const lazy = createLazyStore<WithPersist<StoreApi<BlockchainStore>, unknown>>()

export const useBlockchainStore: UseBoundStore<
    WithPersist<StoreApi<BlockchainStore>, unknown>
> = lazy.useStore

const createBlockchainStore = (storage: KeyValueStorageService) =>
    create<BlockchainStore>()(
        persist(
            (set, get) => ({
                pendingSignRequests: [],
                addSignRequest: (request: SignRequest) => {
                    const existing = get().pendingSignRequests ?? []
                    const newRequest = {
                        ...request,
                        id: request.id ?? uuidv7(),
                    }
                    if (!existing.find(r => r.id === newRequest.id)) {
                        set({ pendingSignRequests: [...existing, newRequest] })
                        return true
                    }
                    return false
                },
                removeSignRequest: (request: SignRequest) => {
                    const existing = get().pendingSignRequests ?? []
                    const remaining = existing.filter(r => r.id !== request.id)

                    if (remaining.length != existing.length) {
                        set({ pendingSignRequests: remaining })
                    }

                    return remaining.length != existing.length
                },
            }),
            {
                name: 'blockchain-store',
                storage: createJSONStorage(() => storage),
                version: 1,
                partialize: state => ({
                    pendingSignRequests: state.pendingSignRequests,
                }),
            },
        ),
    )

export const initBlockchainStore = () => {
    debugLog('Initializing blockchain store')
    const storage = useKeyValueStorageService()
    const realStore = createBlockchainStore(storage)
    lazy.init(realStore)
    debugLog('Blockchain store initialized')
}
