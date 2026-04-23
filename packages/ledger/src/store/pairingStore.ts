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
    registerStore,
    type Nullable,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { HardwareWalletDevice } from '@perawallet/wallet-core-hardware-wallet'

/**
 * Business-logic store for Ledger pairing state.
 *
 * - `pairedDeviceIds` (persisted): portable analog to Android's
 *   `BluetoothAdapter.bondedDevices`. iOS has no equivalent API, so we
 *   record "we have successfully paired with this deviceId before" at
 *   the app level and skip the first-connect pairing sheet on repeats.
 * - `pendingPairingDevice` (in-memory): the device currently awaiting
 *   confirmation from the pairing-instructions sheet. Kept in the store
 *   so the scan screen hook is free of transient UI state and the same
 *   state can be driven by other entry points later.
 */
type State = {
    pairedDeviceIds: string[]
    pendingPairingDevice: Nullable<HardwareWalletDevice>
}

type Actions = {
    isPaired: (deviceId: string) => boolean
    markPaired: (deviceId: string) => void
    forgetDevice: (deviceId: string) => void
    setPendingPairingDevice: (device: Nullable<HardwareWalletDevice>) => void
    resetState: () => void
}

type Store = State & Actions

const STORE_NAME = 'ledger-pairing-store'

const initialState: State = {
    pairedDeviceIds: [],
    pendingPairingDevice: null,
}

export const useLedgerPairingStore: UseBoundStore<
    WithPersist<StoreApi<Store>, unknown>
> = create<Store>()(
    persist(
        (set, get) => ({
            ...initialState,
            isPaired: (deviceId: string) =>
                get().pairedDeviceIds.includes(deviceId),
            markPaired: (deviceId: string) => {
                const existing = get().pairedDeviceIds
                if (existing.includes(deviceId)) return
                set({ pairedDeviceIds: [...existing, deviceId] })
            },
            forgetDevice: (deviceId: string) => {
                const existing = get().pairedDeviceIds
                const next = existing.filter(id => id !== deviceId)
                if (next.length === existing.length) return
                set({ pairedDeviceIds: next })
            },
            setPendingPairingDevice: device =>
                set({ pendingPairingDevice: device }),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            // pendingPairingDevice is live-session UI state only — persisting
            // it would resurrect a dismissed sheet after an app restart.
            partialize: state => ({ pairedDeviceIds: state.pairedDeviceIds }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useLedgerPairingStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useLedgerPairingStore.getState().resetState(),
})
