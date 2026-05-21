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

import { create } from 'zustand'
import type { BaseStoreState } from '@perawallet/wallet-core-shared'
import type { PendingWalletConnectHandoff } from '../pipeline/walletConnectHandoffs'

/**
 * In-memory registry of WC sync-flow handoffs.
 *
 * Cross-cutting state held in a Zustand store to match the rest of the
 * codebase; not persisted because the entries hold non-serializable
 * function references (peer callbacks) that don't survive a process
 * restart. An app kill drops tracking — the on-chain sign-request still
 * exists and the user can finish it from the inbox flow.
 */
type State = {
    handoffs: Record<string, PendingWalletConnectHandoff>
}

type Actions = {
    register: (handoff: PendingWalletConnectHandoff) => void
    unregister: (signRequestId: string) => void
} & BaseStoreState

export type WalletConnectHandoffsStore = State & Actions

export const useWalletConnectHandoffsStore = create<WalletConnectHandoffsStore>(
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
)
