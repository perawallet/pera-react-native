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
import { registerStore, type WithPersist } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

/**
 * Tracks which Ledger device IDs the user has successfully paired with.
 * Used as a portable analog to Android's `BluetoothAdapter.bondedDevices` —
 * iOS has no equivalent API, so we record success at the app level.
 *
 * Lives in apps/mobile (not packages/ledger) because the package graph has
 * `wallet-extension-provider → wallet-extension-ledger-react-native →
 * wallet-core-ledger`. Hosting a store that imports getProvider in the
 * leaf ledger package would close that cycle. The state is purely UI
 * (which devices have we shown pairing instructions to), so apps/mobile
 * is the right home anyway.
 *
 * The pairing-instructions bottom sheet is shown only on the first connect
 * attempt to a deviceId not in this set; once a connection succeeds the
 * deviceId is added and subsequent connects skip the sheet.
 */
type State = {
    pairedDeviceIds: string[]
}

type Actions = {
    isPaired: (deviceId: string) => boolean
    markPaired: (deviceId: string) => void
    forgetDevice: (deviceId: string) => void
    resetState: () => void
}

type Store = State & Actions

const STORE_NAME = 'ledger-paired-devices-store'

const initialState: State = {
    pairedDeviceIds: [],
}

export const useLedgerPairedDevicesStore: UseBoundStore<
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
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            partialize: state => ({ pairedDeviceIds: state.pairedDeviceIds }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useLedgerPairedDevicesStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useLedgerPairedDevicesStore.getState().resetState(),
})
