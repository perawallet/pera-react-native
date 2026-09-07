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

type PromptState = {
    /**
     * Prompts answered or hidden this session. Deliberately unpersisted — the
     * durable "never show again" answers are one-time preference flags
     * (UserPreferences), while these cover "not now" for this launch.
     *
     * Lives here rather than in the container's component state because the
     * container remounts, and a hidden prompt returning after a remount is one
     * of the ways the same prompt appeared twice.
     */
    dismissedIds: string[]
    /**
     * The "don't ambush the user the instant they open the app" delay is paid
     * once per session, not per prompt. Paying it per prompt is what turned a
     * post-migration launch into a sequence of separate ambushes.
     */
    hasPaidEntryDelay: boolean
}

type PromptActions = {
    dismiss: (id: string) => void
    markEntryDelayPaid: () => void
    resetState: () => void
}

type PromptStore = PromptState & PromptActions

const initialState: PromptState = {
    dismissedIds: [],
    hasPaidEntryDelay: false,
}

export const usePromptStore: UseBoundStore<StoreApi<PromptStore>> =
    create<PromptStore>()(set => ({
        ...initialState,
        dismiss: (id: string) => {
            set(state => {
                // Return the same array when nothing changes: a fresh one would
                // re-render every subscriber on a repeat dismissal.
                if (state.dismissedIds.includes(id)) return {}
                return { dismissedIds: [...state.dismissedIds, id] }
            })
        },
        markEntryDelayPaid: () => set({ hasPaidEntryDelay: true }),
        resetState: () => set(initialState),
    }))
