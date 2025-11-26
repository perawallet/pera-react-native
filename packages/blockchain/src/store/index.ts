import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useKeyValueStorageService } from '@perawallet/wallet-core-platform-integration'
import type { BlockchainStore, SignRequest } from '../models'
import type { WithPersist } from '@perawallet/wallet-core-shared'
import { v7 as uuidv7 } from 'uuid'

export const useBlockchainStore: UseBoundStore<
    WithPersist<StoreApi<BlockchainStore>, unknown>
> = create<BlockchainStore>()(
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
            storage: createJSONStorage(useKeyValueStorageService),
            version: 1,
            partialize: state => ({
                pendingSignRequests: state.pendingSignRequests,
            }),
        },
    ),
)
