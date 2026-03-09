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
import type {
    WalletConnectConnection,
    WalletConnectSessionRequest,
    WalletConnectStore,
} from '../models'
import { registerStore, type WithPersist } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'wallet-connect-store'

const initialState = {
    walletConnectConnections: [] as WalletConnectConnection[],
    sessionRequests: [] as WalletConnectSessionRequest[],
}

export const useWalletConnectStore: UseBoundStore<
    WithPersist<StoreApi<WalletConnectStore>, unknown>
> = create<WalletConnectStore>()(
    persist(
        set => ({
            ...initialState,
            setWalletConnectConnections: (
                walletConnectConnections: WalletConnectConnection[],
            ) => set({ walletConnectConnections }),
            setSessionRequests: (
                sessionRequests: WalletConnectSessionRequest[],
            ) => set({ sessionRequests }),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            partialize: state => ({
                walletConnectConnections: state.walletConnectConnections,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useWalletConnectStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useWalletConnectStore.getState().resetState(),
})
