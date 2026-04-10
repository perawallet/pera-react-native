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
import { registerStore } from '@perawallet/wallet-core-shared'

export type Participant = {
    address: string
    name?: string
    isLocal: boolean
}

type MultisigCreationState = {
    participants: Participant[]
    threshold: number
    accountName: string
}

type MultisigCreationActions = {
    addParticipant: (participant: Participant) => void
    removeParticipant: (address: string) => void
    updateParticipant: (address: string, name: string | undefined) => void
    setThreshold: (threshold: number) => void
    setAccountName: (name: string) => void
    resetState: () => void
    clearStorage: () => void
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
    removeParticipant: (address: string) =>
        set(state => ({
            participants: state.participants.filter(p => p.address !== address),
        })),
    updateParticipant: (address: string, name: string | undefined) =>
        set(state => ({
            participants: state.participants.map(p =>
                p.address === address ? { ...p, name } : p,
            ),
        })),
    setThreshold: (threshold: number) => set({ threshold }),
    setAccountName: (name: string) => set({ accountName: name }),
    resetState: () => set(initialState),
    clearStorage: () => {},
}))

registerStore({
    name: 'multisig-creation-store',
    clearStorage: () => {},
    resetState: () => useMultisigCreationStore.getState().resetState(),
})
