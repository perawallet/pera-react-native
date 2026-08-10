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
import { type Optional, registerStore } from '@perawallet/wallet-core-shared'

export type Participant = {
    address: string
    name?: string
}

type MultisigCreationState = {
    participants: Participant[]
    threshold: number
    accountName: string
}

type MultisigCreationActions = {
    addParticipant: (participant: Participant) => void
    removeParticipant: (index: number) => void
    updateParticipant: (address: string, name: Optional<string>) => void
    setThreshold: (threshold: number) => void
    setAccountName: (name: string) => void
    resetState: () => void
}

type MultisigCreationStore = MultisigCreationState & MultisigCreationActions

const initialState: MultisigCreationState = {
    participants: [],
    threshold: 2,
    accountName: '',
}

export const useMultisigCreationStore = create<MultisigCreationStore>(set => ({
    ...initialState,
    addParticipant: (participant: Participant) =>
        set(state => ({
            participants: [...state.participants, participant],
        })),
    // The same address may legitimately occupy multiple multisig slots, so the
    // two mutators below are keyed differently on purpose:
    // - removeParticipant is index-keyed — it drops exactly one slot.
    // - updateParticipant is address-keyed — a name follows the contact
    //   identity, so a rename propagates to every slot sharing that address.
    removeParticipant: (index: number) =>
        set(state => {
            const participants = state.participants.filter(
                (_, i) => i !== index,
            )
            // Lower the threshold to match when a removal drops the participant
            // count below it — otherwise creation dead-ends at the final step,
            // where algosdk rejects a threshold greater than the participant
            // count with no way back to fix it.
            return {
                participants,
                threshold: Math.min(
                    state.threshold,
                    Math.max(1, participants.length),
                ),
            }
        }),
    updateParticipant: (address: string, name: Optional<string>) =>
        set(state => ({
            participants: state.participants.map(p =>
                p.address === address ? { ...p, name } : p,
            ),
        })),
    setThreshold: (threshold: number) => set({ threshold }),
    setAccountName: (name: string) => set({ accountName: name }),
    resetState: () => set(initialState),
}))

registerStore({
    name: 'multisig-creation-store',
    clearStorage: () => {},
    resetState: () => useMultisigCreationStore.getState().resetState(),
})
