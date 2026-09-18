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
import type { SwapGroupState } from '../utils/submitSwapGroups'

export type SwapResumeRecord<TGroup = unknown> = {
    quoteId: string
    swapId?: string
    groups: TGroup[]
    groupStates: SwapGroupState[]
    createdAt: number
}

export type SwapResumeState = {
    records: Record<string, SwapResumeRecord>
    recordResume: (record: Omit<SwapResumeRecord, 'createdAt'>) => void
    getResume: (quoteId: string) => SwapResumeRecord | undefined
    clearResume: (quoteId: string) => void
    resetState: () => void
}

const initialState = {
    records: {} as Record<string, SwapResumeRecord>,
}

/**
 * Signed groups of a swap whose submit loop stopped part-way, so the next
 * confirm re-broadcasts exactly the un-landed bytes — no re-prepare, no
 * re-sign, no new txids.
 *
 * Deliberately in memory only: signed transaction bytes carry a validity
 * window that will have expired long before a later launch, and the
 * submission ledger already owns crash-time convergence.
 */
export const useSwapResumeStore: UseBoundStore<StoreApi<SwapResumeState>> =
    create<SwapResumeState>()((set, get) => ({
        ...initialState,
        recordResume: record =>
            set(state => ({
                records: {
                    ...state.records,
                    [record.quoteId]: { ...record, createdAt: Date.now() },
                },
            })),
        getResume: quoteId => get().records[quoteId],
        clearResume: quoteId =>
            set(state => {
                if (!state.records[quoteId]) return state
                const { [quoteId]: _removed, ...rest } = state.records
                return { records: rest }
            }),
        resetState: () => set({ ...initialState }),
    }))
