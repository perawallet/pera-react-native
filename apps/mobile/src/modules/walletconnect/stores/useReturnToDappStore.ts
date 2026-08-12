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

import { create } from 'zustand'
import type { WalletConnectPairingOriginSource } from '@perawallet/wallet-core-walletconnect'

export type ReturnToDappContext = {
    /** Where the pairing entered the wallet — see the type's doc comment. */
    origin: WalletConnectPairingOriginSource
    /** iOS wrapper's `browser` param; absent on Android (raw wc: intent). */
    browserName?: string
    /** Epoch ms; lets later writes prune abandoned entries. */
    createdAt: number
}

/**
 * Pairings the package's TTL pruning drops never come back through the
 * provider's cleanup paths, so writes sweep anything older than this.
 */
const CONTEXT_TTL_MS = 10 * 60 * 1000

type State = {
    returnContexts: Record<string, ReturnToDappContext>
}

type Actions = {
    setReturnContext: (
        clientId: string,
        context: Omit<ReturnToDappContext, 'createdAt'>,
    ) => void
    clearReturnContext: (clientId: string) => void
    resetState: () => void
}

type Store = State & Actions

const initialState: State = {
    returnContexts: {},
}

/**
 * Deliberately not persisted: a return context points at the browser task
 * that launched the app, which is gone after a restart.
 */
export const useReturnToDappStore = create<Store>(set => ({
    ...initialState,
    setReturnContext: (clientId, context) =>
        set(state => {
            const now = Date.now()
            const returnContexts: Record<string, ReturnToDappContext> = {}
            for (const [id, entry] of Object.entries(state.returnContexts)) {
                if (now - entry.createdAt < CONTEXT_TTL_MS) {
                    returnContexts[id] = entry
                }
            }
            returnContexts[clientId] = { ...context, createdAt: now }
            return { returnContexts }
        }),
    clearReturnContext: clientId =>
        set(state => {
            if (!(clientId in state.returnContexts)) return state
            const { [clientId]: _removed, ...returnContexts } =
                state.returnContexts
            return { returnContexts }
        }),
    resetState: () => set(initialState),
}))
