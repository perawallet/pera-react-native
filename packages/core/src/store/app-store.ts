import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
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

export type AppState = SettingsSlice &
    AccountsSlice &
    BlockchainSlice &
    DeviceSlice
export const useAppStore = create<AppState>()(
    persist(
        (...a) => ({
            ...createSettingsSlice(...a),
            ...createBlockchainSlice(...a),
            ...createAccountsSlice(...a),
            ...createDeviceSlice(...a),
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
            }),
        },
    ),
)
