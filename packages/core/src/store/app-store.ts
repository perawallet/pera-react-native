import { create, type StoreApi, type UseBoundStore } from 'zustand'
import {
    persist,
    createJSONStorage,
    type PersistOptions,
} from 'zustand/middleware'
import { useKeyValueStorageService } from '../services'
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
    createDeviceSlice,
    partializeDeviceSlice,
    type DeviceSlice,
} from '../services/device/store'
import {
    createPollingSlice,
    partializePollingSlice,
    type PollingSlice,
} from '../services/polling/store'
import {
    createSwapsSlice,
    partializeSwapsSlice,
    type SwapsSlice,
} from '../services/swaps'
import {
    createAssetsSlice,
    partializeAssetsSlice,
    type AssetsSlice,
} from '../services/assets'

export type AppState = SettingsSlice &
    AccountsSlice &
    AssetsSlice &
    BlockchainSlice &
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
                ...partializeAccountsSlice(state),
                ...partializeDeviceSlice(state),
                ...partializePollingSlice(state),
                ...partializeSwapsSlice(state),
                ...partializeAssetsSlice(state),
            }),
        },
    ),
)

export const reinitializeAppStore = () => {
    useAppStore = create<AppState>()(
        persist(
            (...a) => ({
                ...createSettingsSlice(...a),
                ...createBlockchainSlice(...a),
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
                    ...partializeAccountsSlice(state),
                    ...partializeDeviceSlice(state),
                    ...partializePollingSlice(state),
                    ...partializeSwapsSlice(state),
                    ...partializeAssetsSlice(state),
                }),
            },
        ),
    )
    return useAppStore
}
