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

/**
 * In-memory handoff store for sensitive recovery data passed between
 * navigation events. Source paths (QR scan, deeplink) `stash` an entry
 * and push only the returned handoff id through React Navigation; the
 * destination `consume`s it once on mount.
 *
 * No `persist` middleware: the mnemonic must never reach disk. The `Map`
 * data shape would also fail JSON serialization, surfacing any future
 * accidental `persist` config as a loud error rather than a silent leak.
 */

import { create } from 'zustand'
import type { ImportAccountType } from '@perawallet/wallet-core-accounts'

type HandoffEntry = {
    accountType: ImportAccountType
    mnemonic: string
}

type State = {
    pending: Map<string, HandoffEntry>
    nextId: number
}

type Actions = {
    stash: (entry: HandoffEntry) => string
    consume: (handoffId: string) => HandoffEntry | null
    resetState: () => void
}

type Store = State & Actions

const initialState: State = {
    pending: new Map(),
    nextId: 1,
}

export const useMnemonicHandoffStore = create<Store>((set, get) => ({
    ...initialState,
    stash: entry => {
        const id = String(get().nextId)
        set(state => {
            const next = new Map(state.pending)
            next.set(id, entry)
            return { pending: next, nextId: state.nextId + 1 }
        })
        return id
    },
    consume: handoffId => {
        const entry = get().pending.get(handoffId) ?? null
        if (entry) {
            set(state => {
                const next = new Map(state.pending)
                next.delete(handoffId)
                return { pending: next }
            })
        }
        return entry
    },
    resetState: () => set(initialState),
}))
