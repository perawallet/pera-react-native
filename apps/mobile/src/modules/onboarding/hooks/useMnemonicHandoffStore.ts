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
 *
 * Each stashed entry is auto-evicted after `TTL_MS` so a leaked entry
 * (user backs out before destination mounts) doesn't sit in memory
 * indefinitely. `consume` and `resetState` both cancel pending timers.
 */

import { create } from 'zustand'
import type { ImportAccountType } from '@perawallet/wallet-core-accounts'

const TTL_MS = 30_000

type HandoffEntry = {
    accountType: ImportAccountType
    mnemonic: string
}

type State = {
    pending: Map<string, HandoffEntry>
    timers: Map<string, ReturnType<typeof setTimeout>>
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
    timers: new Map(),
    nextId: 1,
}

export const useMnemonicHandoffStore = create<Store>((set, get) => ({
    ...initialState,
    stash: entry => {
        const id = String(get().nextId)
        const timer = setTimeout(() => {
            set(state => {
                if (!state.pending.has(id)) return state
                const nextPending = new Map(state.pending)
                const nextTimers = new Map(state.timers)
                nextPending.delete(id)
                nextTimers.delete(id)
                return { pending: nextPending, timers: nextTimers }
            })
        }, TTL_MS)
        set(state => {
            const nextPending = new Map(state.pending)
            const nextTimers = new Map(state.timers)
            nextPending.set(id, entry)
            nextTimers.set(id, timer)
            return {
                pending: nextPending,
                timers: nextTimers,
                nextId: state.nextId + 1,
            }
        })
        return id
    },
    consume: handoffId => {
        const entry = get().pending.get(handoffId) ?? null
        if (entry) {
            const timer = get().timers.get(handoffId)
            if (timer !== undefined) clearTimeout(timer)
            set(state => {
                const nextPending = new Map(state.pending)
                const nextTimers = new Map(state.timers)
                nextPending.delete(handoffId)
                nextTimers.delete(handoffId)
                return { pending: nextPending, timers: nextTimers }
            })
        }
        return entry
    },
    resetState: () => {
        for (const timer of get().timers.values()) {
            clearTimeout(timer)
        }
        set({
            pending: new Map(),
            timers: new Map(),
            nextId: 1,
        })
    },
}))
