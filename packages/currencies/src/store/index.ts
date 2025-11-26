import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useKeyValueStorageService } from '@perawallet/wallet-core-platform-integration'
import type { CurrenciesStore } from '../models'
import type { WithPersist } from '@perawallet/wallet-core-shared'

export const useCurrenciesStore: UseBoundStore<
    WithPersist<StoreApi<CurrenciesStore>, unknown>
> = create<CurrenciesStore>()(
    persist(
        set => ({
            preferredCurrency: 'USD',
            setPreferredCurrency: (currency: string) =>
                set({ preferredCurrency: currency }),
        }),
        {
            name: 'currencies-store',
            storage: createJSONStorage(useKeyValueStorageService),
            version: 1,
            partialize: state => ({
                preferredCurrency: state.preferredCurrency,
            }),
        },
    ),
)
