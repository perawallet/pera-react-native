import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useKeyValueStorageService } from '@perawallet/wallet-core-platform-integration'
import type { AssetsState } from '../models'
import type { WithPersist } from '@perawallet/wallet-core-shared'

export const useAssetsStore: UseBoundStore<
    WithPersist<StoreApi<AssetsState>, unknown>
> = create<AssetsState>()(
    persist(
        set => ({
            assetIDs: [],
            setAssetIDs: (assetIDs: string[]) => {
                set({ assetIDs })
            },
        }),
        {
            name: 'assets-store',
            storage: createJSONStorage(useKeyValueStorageService),
            version: 1,
            partialize: state => ({
                assetIDs: state.assetIDs,
            }),
        },
    ),
)
