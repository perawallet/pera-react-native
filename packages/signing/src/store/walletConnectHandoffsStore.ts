/*
 Copyright 2022-2026 Pera Wallet, LDA
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
    type BaseStoreState,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { PendingWalletConnectHandoff } from '../pipeline/walletConnectHandoffs'

const STORE_NAME = 'wallet-connect-handoffs-store'

/**
 * Persisted registry of WC sync-flow handoffs.
 *
 * Persisted so a WalletConnect handoff survives an app kill: killing the
 * proposer app used to lose the request everywhere and hang the dApp, because
 * the registry was in-memory. The record's `callbacks` closures don't
 * serialize (JSON drops function values), so only the serializable fields —
 * including the WC-only `recovery` context — survive; on relaunch the resolver
 * rehydrates these, polls for the assembled signatures, and best-effort answers
 * the peer via `recovery`. Webview/deeplink/injected handoffs carry no
 * `recovery` and can't be resumed post-kill (their caller is gone). The
 * before-propagate window (kill before the backend record exists) is still
 * lossy — there is nothing durable to recover yet.
 */
type State = {
    handoffs: Record<string, PendingWalletConnectHandoff>
}

type Actions = {
    register: (handoff: PendingWalletConnectHandoff) => void
    unregister: (signRequestId: string) => void
} & BaseStoreState

export type WalletConnectHandoffsStore = State & Actions

export const useWalletConnectHandoffsStore: UseBoundStore<
    WithPersist<StoreApi<WalletConnectHandoffsStore>, unknown>
> = create<WalletConnectHandoffsStore>()(
    persist(
        set => ({
            handoffs: {},
            register: handoff =>
                set(s => ({
                    handoffs: {
                        ...s.handoffs,
                        [handoff.signRequestId]: handoff,
                    },
                })),
            unregister: signRequestId =>
                set(s => {
                    if (!(signRequestId in s.handoffs)) return s
                    const next = { ...s.handoffs }
                    delete next[signRequestId]
                    return { handoffs: next }
                }),
            resetState: () => set({ handoffs: {} }),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 1,
            partialize: state => ({ handoffs: state.handoffs }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useWalletConnectHandoffsStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useWalletConnectHandoffsStore.getState().resetState(),
})
