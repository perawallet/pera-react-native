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
import {
    persist,
    createJSONStorage,
    type PersistOptions,
} from 'zustand/middleware'
import { useKeyValueStorageService } from '../services/storage/platform-service'
import {
    createAccountsSlice,
    partializeAccountsSlice,
    type AccountsSlice,
} from '../services/accounts/store'
import {
    createBlockchainSlice,
    partializeBlockchainSlice,
    type BlockchainSlice,
} from '../services/blockchain/store'
import {
    createSettingsSlice,
    partializeSettingsSlice,
    type SettingsSlice,
} from '../services/settings/store'
import {
    createPollingSlice,
    partializePollingSlice,
    type PollingSlice,
} from '../services/polling/store'
import {
    createSwapsSlice,
    partializeSwapsSlice,
    type SwapsSlice,
} from '../services/swaps/store'
import {
    createAssetsSlice,
    partializeAssetsSlice,
    type AssetsSlice,
} from '../services/assets/store'
import {
    createContactsSlice,
    partializeContactsSlice,
    type ContactsSlice,
} from '../services/contacts/store'
import {
    createDeviceSlice,
    partializeDeviceSlice,
    rehydrateDeviceSlice,
    type DeviceSlice,
} from '../services/device/store'

export type AppState = SettingsSlice &
    AccountsSlice &
    AssetsSlice &
    BlockchainSlice &
    ContactsSlice &
    DeviceSlice &
    PollingSlice &
    SwapsSlice

type PersistListener<S> = (state: S) => void

type StorePersist<S, Ps, Pr> = S extends {
    getState: () => infer T
    setState: {
        // capture both overloads of setState
        (...args: infer Sa1): infer Sr1
        (...args: infer Sa2): infer Sr2
    }
}
    ? {
          setState(...args: Sa1): Sr1 | Pr
          setState(...args: Sa2): Sr2 | Pr
          persist: {
              setOptions: (options: Partial<PersistOptions<T, Ps, Pr>>) => void
              clearStorage: () => void
              rehydrate: () => Promise<void> | void
              hasHydrated: () => boolean
              onHydrate: (fn: PersistListener<T>) => () => void
              onFinishHydration: (fn: PersistListener<T>) => () => void
              getOptions: () => Partial<PersistOptions<T, Ps, Pr>>
          }
      }
    : never

type Write<T, U> = Omit<T, keyof U> & U

type WithPersist<S, A> = Write<S, StorePersist<S, A, unknown>>

export let useAppStore: UseBoundStore<
    WithPersist<StoreApi<AppState>, unknown>
> = create<AppState>()(
    persist(
        (...a) => ({
            ...createSettingsSlice(...a),
            ...createBlockchainSlice(...a),
            ...createContactsSlice(...a),
            ...createAccountsSlice(...a),
            ...createDeviceSlice(...a),
            ...createPollingSlice(...a),
            ...createSwapsSlice(...a),
            ...createAssetsSlice(...a),
        }),
        {
            name: 'app-store',
            storage: createJSONStorage(useKeyValueStorageService),
            version: 1,
            partialize: state => ({
                ...partializeSettingsSlice(state),
                ...partializeBlockchainSlice(state),
                ...partializeContactsSlice(state),
                ...partializeAccountsSlice(state),
                ...partializeDeviceSlice(state),
                ...partializePollingSlice(state),
                ...partializeSwapsSlice(state),
                ...partializeAssetsSlice(state),
            }),
            onRehydrateStorage: () => state => {
                if (state) {
                    // Rehydrate device slice to convert deviceIDs back to Map
                    const deviceState = rehydrateDeviceSlice(state)
                    Object.assign(state, deviceState)
                }
            },
        },
    ),
)

export const reinitializeAppStore = () => {
    useAppStore = create<AppState>()(
        persist(
            (...a) => ({
                ...createSettingsSlice(...a),
                ...createBlockchainSlice(...a),
                ...createContactsSlice(...a),
                ...createAccountsSlice(...a),
                ...createDeviceSlice(...a),
                ...createPollingSlice(...a),
                ...createSwapsSlice(...a),
                ...createAssetsSlice(...a),
            }),
            {
                name: 'app-store',
                storage: createJSONStorage(useKeyValueStorageService),
                version: 1,
                partialize: state => ({
                    ...partializeSettingsSlice(state),
                    ...partializeBlockchainSlice(state),
                    ...partializeContactsSlice(state),
                    ...partializeAccountsSlice(state),
                    ...partializeDeviceSlice(state),
                    ...partializePollingSlice(state),
                    ...partializeSwapsSlice(state),
                    ...partializeAssetsSlice(state),
                }),
                onRehydrateStorage: () => state => {
                    if (state) {
                        // Rehydrate device slice to convert deviceIDs back to Map
                        const deviceState = rehydrateDeviceSlice(state)
                        Object.assign(state, deviceState)
                    }
                },
            },
        ),
    )
    return useAppStore
}
