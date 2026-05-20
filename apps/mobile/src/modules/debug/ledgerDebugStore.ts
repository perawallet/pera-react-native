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

/**
 * [LEDGER-DEBUG] On-screen overlay backing store. Temporary; deleted along
 * with the rest of the LEDGER-DEBUG instrumentation once the
 * SendFunds-modal-dismiss root cause is identified.
 */

type LedgerDebugEntry = {
    id: number
    at: string
    label: string
    detail: string
}

type State = {
    entries: LedgerDebugEntry[]
    visible: boolean
}

type Actions = {
    push: (label: string, detail?: Record<string, unknown> | string) => void
    clear: () => void
    setVisible: (visible: boolean) => void
}

const MAX_ENTRIES = 40

let nextId = 1

export const useLedgerDebugStore = create<State & Actions>(set => ({
    entries: [],
    visible: true,
    push: (label, detail) => {
        const entry: LedgerDebugEntry = {
            id: nextId++,
            at: new Date().toISOString().slice(11, 23), // HH:MM:SS.sss
            label,
            detail:
                detail == null
                    ? ''
                    : typeof detail === 'string'
                      ? detail
                      : JSON.stringify(detail),
        }
        // Also mirror to console.warn so existing log channels still get it.
        // eslint-disable-next-line no-console
        console.warn(`[LEDGER-DEBUG] ${label}`, entry.detail)
        set(state => ({
            entries: [...state.entries, entry].slice(-MAX_ENTRIES),
        }))
    },
    clear: () => set({ entries: [] }),
    setVisible: visible => set({ visible }),
}))

// Module-scope helper so non-component code (Zustand store setters, helpers)
// can push without React hooks.
export const pushLedgerDebug = (
    label: string,
    detail?: Record<string, unknown> | string,
) => useLedgerDebugStore.getState().push(label, detail)
