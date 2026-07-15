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
import type {
    AsbBackupEnvelope,
    AsbBackupPayload,
} from '@perawallet/wallet-core-backup'
import { zeroBytes } from '@perawallet/wallet-core-kms'

// Transient state for the ASB recovery wizard: holds the parsed envelope
// (from the file-pick step), the decrypted payload (from the key-entry step),
// and the user's selection across the multi-step UI. Kept in memory only —
// the decrypted private keys must never persist across app launches.
//
// We deliberately do not put this in `packages/backup` because it is UI flow
// state, not domain state. Screens reset it on entry to the flow.

type State = {
    envelope: AsbBackupEnvelope | null
    payload: AsbBackupPayload | null
    selectedAddresses: string[]
}

type Actions = {
    setEnvelope: (envelope: AsbBackupEnvelope) => void
    setPayload: (payload: AsbBackupPayload) => void
    toggleSelection: (address: string) => void
    setSelection: (addresses: string[]) => void
    reset: () => void
}

const initialState: State = {
    envelope: null,
    payload: null,
    selectedAddresses: [],
}

export const useAsbImportFlowStore = create<State & Actions>((set, get) => ({
    ...initialState,
    setEnvelope: envelope => set({ envelope }),
    setPayload: payload =>
        // Default to selecting every importable account, matching iOS/Android.
        // The selection screen filters out already-imported addresses before
        // displaying, so we don't have to do that here.
        set({
            payload,
            selectedAddresses: payload.accounts.map(a => a.address),
        }),
    toggleSelection: address => {
        const current = get().selectedAddresses
        const next = current.includes(address)
            ? current.filter(a => a !== address)
            : [...current, address]
        set({ selectedAddresses: next })
    },
    setSelection: addresses => set({ selectedAddresses: addresses }),
    reset: () => {
        // Wipe any decrypted single-account secret keys still sitting in the
        // store before dropping the payload reference. We can't reach the
        // base64 source strings (immutable), but the binary buffers are
        // ours to clean.
        const payload = get().payload
        if (payload) {
            for (const account of payload.accounts) {
                zeroBytes(account.privateKey)
            }
        }
        set(initialState)
    },
}))
