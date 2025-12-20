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
import type { WalletConnectSession, WalletConnectStore } from '../models'
import type { WithPersist } from '@perawallet/wallet-core-shared'
import {
    KeyValueStorageService,
    useKeyValueStorageService,
} from '@perawallet/wallet-core-platform-integration'
import { createLazyStore, logger } from '@perawallet/wallet-core-shared'

const lazy =
    createLazyStore<WithPersist<StoreApi<WalletConnectStore>, unknown>>()

export const useWalletConnectStore: UseBoundStore<
    WithPersist<StoreApi<WalletConnectStore>, unknown>
> = lazy.useStore

const createWalletConnectStore = (storage: KeyValueStorageService) =>
    create<WalletConnectStore>()(
        persist(
            set => ({
                walletConnectSessions: [],
                setWalletConnectSessions: (
                    walletConnectSessions: WalletConnectSession[],
                ) => set({ walletConnectSessions }),
            }),
            {
                name: 'wallet-connect-store',
                storage: createJSONStorage(() => storage),
                version: 1,
                partialize: state => ({
                    walletConnectSessions: state.walletConnectSessions,
                }),
            },
        ),
    )

export const initWalletConnectStore = () => {
    logger.debug('Initializing wallet connect store')
    const storage = useKeyValueStorageService()
    const realStore = createWalletConnectStore(storage)
    lazy.init(realStore)
    logger.debug('Wallet connect store initialized')
}
