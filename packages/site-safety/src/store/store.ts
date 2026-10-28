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
import {
    guardedPersist,
    registerStore,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { ActiveGenerations, PhishingListSourceId } from '../models'

const STORE_NAME = 'site-safety-phishing-lists-store'

export type PhishingListSourceState = {
    generation: number
    /** The server's ETag for the downloaded copy; absent for the bundled one. */
    etag?: string
    /** Epoch ms of the last successful check, including a `304`. */
    refreshedAt: number
    origin: 'bundled' | 'downloaded'
}

type PhishingListState = {
    sources: Partial<Record<PhishingListSourceId, PhishingListSourceState>>
}

type PhishingListActions = {
    activateGeneration: (
        source: PhishingListSourceId,
        state: PhishingListSourceState,
    ) => void
    markRefreshed: (source: PhishingListSourceId, at: number) => void
    resetState: () => void
}

export type PhishingListStore = PhishingListState & PhishingListActions

const getInitialState = (): PhishingListState => ({ sources: {} })

export const usePhishingListStore: UseBoundStore<
    WithPersist<StoreApi<PhishingListStore>, unknown>
> = create<PhishingListStore>()(
    guardedPersist(
        (set, get) => ({
            ...getInitialState(),
            activateGeneration: (source, state) => {
                set({ sources: { ...get().sources, [source]: state } })
            },
            markRefreshed: (source, at) => {
                const current = get().sources[source]
                if (!current) return
                set({
                    sources: {
                        ...get().sources,
                        [source]: { ...current, refreshedAt: at },
                    },
                })
            },
            resetState: () => set(getInitialState()),
        }),
        {
            name: STORE_NAME,
            storage: () => getProvider().keyValueStorage,
            version: 1,
            partialize: state => ({ sources: state.sources }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            usePhishingListStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => usePhishingListStore.getState().resetState(),
})

export const selectActiveGenerations = (
    state: PhishingListState,
): ActiveGenerations =>
    Object.fromEntries(
        Object.entries(state.sources).map(([source, sourceState]) => [
            source,
            sourceState?.generation,
        ]),
    )
