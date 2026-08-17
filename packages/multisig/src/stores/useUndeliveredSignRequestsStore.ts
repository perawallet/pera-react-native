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

/** Retained ids, oldest evicted first. */
export const UNDELIVERED_SIGN_REQUEST_LIMIT = 50

type State = {
    /** Insertion-ordered; index 0 is the oldest. */
    signRequestIds: string[]
}

type Actions = {
    markUndelivered: (signRequestId: string) => void
    clearUndelivered: (signRequestId: string) => void
    isUndelivered: (signRequestId: string) => boolean
    resetState: () => void
}

type Store = State & Actions

const initialState: State = {
    signRequestIds: [],
}

/**
 * Sign requests that reached threshold but whose signed transaction could not
 * be handed back to the requesting dApp (its session was gone).
 *
 * Such a request is stranded: the backend keeps it at `ready`/`submitting`
 * because the signatures are complete, and for a `sync` request the backend
 * deliberately never broadcasts — the wallet was the deliverer. A proposer
 * decline can't move it either (the backend treats a complete request as
 * final, mirroring pera-android's Cancel gate). So the record lingers until
 * the backend's own expiry, and the UI would otherwise keep claiming
 * "Submitting transaction…" — which is untrue and unactionable.
 *
 * This marker exists purely so the sheet can say what actually happened.
 * Not persisted, matching {@link useDraftSignRequestStore}: it's re-derived
 * whenever a resumed handoff re-detects the failure, and a stale marker could
 * only ever attach to its own dead request id, never to a new one.
 */
export const useUndeliveredSignRequestsStore = create<Store>((set, get) => ({
    ...initialState,
    markUndelivered: (signRequestId: string) => {
        set(state => {
            if (state.signRequestIds.includes(signRequestId)) return state
            const next = [...state.signRequestIds, signRequestId]
            return {
                signRequestIds: next.slice(-UNDELIVERED_SIGN_REQUEST_LIMIT),
            }
        })
    },
    clearUndelivered: (signRequestId: string) => {
        set(state => ({
            signRequestIds: state.signRequestIds.filter(
                id => id !== signRequestId,
            ),
        }))
    },
    isUndelivered: (signRequestId: string) =>
        get().signRequestIds.includes(signRequestId),
    resetState: () => set(initialState),
}))
