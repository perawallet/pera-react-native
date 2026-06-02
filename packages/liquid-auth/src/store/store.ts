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
import type {
    LiquidAuthConnectRequest,
    LiquidAuthCredentialRecord,
    LiquidAuthSession,
    LiquidAuthStore,
} from '../models'

const STORE_NAME = 'liquid-auth-store'

const initialState = {
    sessions: [] as LiquidAuthSession[],
    credentials: [] as LiquidAuthCredentialRecord[],
    connectRequest: null as Nullable<LiquidAuthConnectRequest>,
    connectionError: null as Nullable<Error>,
}

export const useLiquidAuthStore: UseBoundStore<
    WithPersist<StoreApi<LiquidAuthStore>, unknown>
> = create<LiquidAuthStore>()(
    persist(
        set => ({
            ...initialState,
            setSessions: (sessions: LiquidAuthSession[]) => set({ sessions }),
            recordCredential: (record: LiquidAuthCredentialRecord) =>
                set(state => ({
                    credentials: [
                        ...state.credentials.filter(
                            credential =>
                                !(
                                    credential.host === record.host &&
                                    credential.address === record.address
                                ),
                        ),
                        record,
                    ],
                })),
            setConnectRequest: (
                connectRequest: Nullable<LiquidAuthConnectRequest>,
            ) => set({ connectRequest }),
            setConnectionError: (connectionError: Nullable<Error>) =>
                set({ connectionError }),
            expireSessions: (now: number) =>
                set(state => ({
                    sessions: state.sessions.filter(
                        s => s.lastActiveAt + s.ttl >= now,
                    ),
                })),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            partialize: state => ({
                sessions: state.sessions,
                credentials: state.credentials,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useLiquidAuthStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useLiquidAuthStore.getState().resetState(),
})
