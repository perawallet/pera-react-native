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
import { persist, createJSONStorage } from 'zustand/middleware'
import { getProvider } from '@perawallet/wallet-extension-provider'

/**
 * Dev-only review tracking for the component gallery. Records which gallery
 * entries have been opened ("seen") and a per-entry good/broken verdict so a
 * reviewer can sweep every sheet and mark its state. Persisted to local
 * storage so progress survives app reloads.
 */
type GalleryReviewState = {
    /** Entry ids that have been opened at least once. */
    visited: Record<string, boolean>
    /** Per-entry verdict: `true` = good, `false` = broken. Absent = unmarked. */
    good: Record<string, boolean>
}

type GalleryReviewActions = {
    markVisited: (id: string) => void
    setGood: (id: string, isGood: boolean) => void
    resetReview: () => void
}

type GalleryReviewStore = GalleryReviewState & GalleryReviewActions

const initialState: GalleryReviewState = { visited: {}, good: {} }

export const useGalleryReviewStore = create<GalleryReviewStore>()(
    persist(
        set => ({
            ...initialState,
            markVisited: id =>
                set(state =>
                    state.visited[id]
                        ? state
                        : { visited: { ...state.visited, [id]: true } },
                ),
            setGood: (id, isGood) =>
                set(state => ({ good: { ...state.good, [id]: isGood } })),
            resetReview: () => set(initialState),
        }),
        {
            name: 'gallery-review-store',
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            partialize: state => ({ visited: state.visited, good: state.good }),
        },
    ),
)
