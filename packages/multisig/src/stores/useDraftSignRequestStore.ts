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
import {
    generateOrderedUniqueId,
    type Network,
} from '@perawallet/wallet-core-shared'
import type { MultiSigAccount, MultisigProposeMode } from '../models'

/**
 * Prefix that distinguishes a locally-created draft sign-request id from a
 * real backend sign-request id. Consumers use `isDraftSignRequestId(id)`
 * to fork between draft-store reads and backend API calls.
 */
export const DRAFT_SIGN_REQUEST_ID_PREFIX = 'draft-'

export const isDraftSignRequestId = (id: string): boolean =>
    id.startsWith(DRAFT_SIGN_REQUEST_ID_PREFIX)

/**
 * Subset of {@link MultiSigAccount} needed to render the pending-signatures
 * sheet for a draft and to bootstrap propose when the user taps the first
 * per-row Sign. Pick'd from `MultiSigAccount` so adding a field there
 * automatically makes it available here.
 */
export type DraftMultisigDetails = Pick<
    MultiSigAccount,
    'threshold' | 'version' | 'participantAddresses'
>

export type DraftSignRequest = {
    localId: string
    network: Network
    multisigAddress: string
    multisigDetails: DraftMultisigDetails
    /** Raw transaction bytes base64-encoded (msgpack, NO "TX" domain prefix). */
    rawTransactionsBase64: string[]
    proposeType: MultisigProposeMode
    createdAt: Date
}

type DraftInput = Omit<DraftSignRequest, 'localId' | 'createdAt'>

type State = {
    drafts: Record<string, DraftSignRequest>
}

type Actions = {
    /** Create a new draft and return its localId (with the `draft-` prefix). */
    createDraft: (input: DraftInput) => string
    /** Resolve a draft by its localId — undefined if missing or already swapped. */
    getDraft: (localId: string) => DraftSignRequest | undefined
    /** Remove a draft after its backend record has been created (propose succeeded). */
    deleteDraft: (localId: string) => void
    resetState: () => void
}

type Store = State & Actions

const initialState: State = {
    drafts: {},
}

/**
 * Transient in-memory store of multisig propose requests that haven't been
 * sent to the backend yet. Populated when the proposer is hardware-only
 * (no local-key participant exists) — instead of auto-firing a Ledger prompt
 * during Send, the signing pipeline short-circuits, the propose transport
 * creates a draft here, and the pending-signatures sheet opens with a
 * synthetic sign-request shape so the user can tap Sign on a Ledger row to
 * bootstrap the real propose.
 *
 * Not persisted: if the app is closed before the first per-row Sign, the
 * draft (and the user's unproposed transaction) is lost. Trade-off accepted
 * by design: zero Ledger prompts during Send.
 */
export const useDraftSignRequestStore = create<Store>((set, get) => ({
    ...initialState,
    createDraft: (input: DraftInput): string => {
        const localId = `${DRAFT_SIGN_REQUEST_ID_PREFIX}${generateOrderedUniqueId()}`
        const draft: DraftSignRequest = {
            ...input,
            localId,
            createdAt: new Date(),
        }
        set(state => ({ drafts: { ...state.drafts, [localId]: draft } }))
        return localId
    },
    getDraft: (localId: string): DraftSignRequest | undefined => {
        return get().drafts[localId]
    },
    deleteDraft: (localId: string) => {
        set(state => {
            if (!(localId in state.drafts)) return state
            const next = { ...state.drafts }
            delete next[localId]
            return { drafts: next }
        })
    },
    resetState: () => set(initialState),
}))
