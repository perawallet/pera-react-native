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
import { registerStore, type WithPersist } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { SwapHandoffRecord, SwapHandoffState } from '../models'

const STORE_NAME = 'swap-handoff-store'

const initialState = {
    handoffs: {} as Record<string, SwapHandoffRecord>,
}

/**
 * Persisted registry of shared-account swaps awaiting co-signer signatures.
 *
 * The proposer's device records a handoff when it proposes the multisig swap
 * (sync mode — the backend won't broadcast). An app-wide resolver polls these,
 * assembles the composite multisig once threshold is met, interleaves the
 * pre-signed slots, and submits to algod. Persistence means a swap that gets
 * co-signed while the proposer's app is closed still completes on next launch.
 */
export const useSwapHandoffStore: UseBoundStore<
    WithPersist<StoreApi<SwapHandoffState>, unknown>
> = create<SwapHandoffState>()(
    persist(
        set => ({
            ...initialState,
            registerHandoff: (record: SwapHandoffRecord) =>
                set(state => ({
                    handoffs: {
                        ...state.handoffs,
                        [record.signRequestId]: record,
                    },
                })),
            markHandoffSubmitted: (signRequestId: string, txIds: string[]) =>
                set(state => {
                    const record = state.handoffs[signRequestId]
                    if (!record) return state
                    return {
                        handoffs: {
                            ...state.handoffs,
                            [signRequestId]: {
                                ...record,
                                submission: { txIds, submittedAt: Date.now() },
                            },
                        },
                    }
                }),
            removeHandoff: (signRequestId: string) =>
                set(state => {
                    if (!state.handoffs[signRequestId]) return state
                    const { [signRequestId]: _removed, ...rest } =
                        state.handoffs
                    return { handoffs: rest }
                }),
            resetState: () => set({ ...initialState }),
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
            useSwapHandoffStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useSwapHandoffStore.getState().resetState(),
})
