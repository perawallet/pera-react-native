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
import { Decimal } from 'decimal.js'
import {
    toScopeKey,
    type AccountChainState,
    type ChainScope,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import { registerStore } from '@perawallet/wallet-core-shared'

/** Keyed like the `account_chain_state` row: scope key, then the account's address on that scope. */
export type AccountChainStateSlice = Partial<
    Record<ChainScopeKey, Readonly<Record<string, AccountChainState>>>
>

export type AccountChainStateStore = {
    states: AccountChainStateSlice
    setAccountChainState(
        scope: ChainScope,
        address: string,
        state: AccountChainState,
    ): void
    fillAccountChainStates(states: AccountChainStateSlice): void
    removeAccountChainStates(address: string): void
    resetState(): void
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && value.constructor === Object

const isEqualValue = (a: unknown, b: unknown): boolean => {
    if (Decimal.isDecimal(a) && Decimal.isDecimal(b)) return a.eq(b)
    if (isPlainObject(a) && isPlainObject(b)) return isEqualRecord(a, b)
    return a === b
}

const isEqualRecord = (
    left: Record<string, unknown>,
    right: Record<string, unknown>,
): boolean =>
    [...new Set([...Object.keys(left), ...Object.keys(right)])].every(key =>
        isEqualValue(left[key], right[key]),
    )

export const isEqualAccountChainState = (
    a: AccountChainState,
    b: AccountChainState,
): boolean =>
    isEqualRecord(a as Record<string, unknown>, b as Record<string, unknown>)

// In memory only: SQLite already holds the durable copy and hydration refills
// this before bootstrap completes.
export const useAccountChainStateStore = create<AccountChainStateStore>(
    (set, get) => ({
        states: {},
        // A write equal to the held entry keeps every reference, so a sync tick
        // with no on-chain change gives subscribers nothing new.
        setAccountChainState: (scope, address, state) => {
            const key = toScopeKey(scope)
            const held = get().states[key]?.[address]
            if (held && isEqualAccountChainState(held, state)) return
            set(prev => ({
                states: {
                    ...prev.states,
                    [key]: { ...prev.states[key], [address]: state },
                },
            }))
        },
        fillAccountChainStates: incoming => {
            const states = { ...get().states }
            let isChanged = false
            for (const [key, entries] of Object.entries(incoming) as [
                ChainScopeKey,
                Readonly<Record<string, AccountChainState>>,
            ][]) {
                const held = states[key]
                const missing = Object.entries(entries).filter(
                    ([address]) => held?.[address] === undefined,
                )
                if (missing.length === 0) continue
                states[key] = { ...held, ...Object.fromEntries(missing) }
                isChanged = true
            }
            if (isChanged) set({ states })
        },
        removeAccountChainStates: address => {
            const states = { ...get().states }
            let isChanged = false
            for (const key of Object.keys(states) as ChainScopeKey[]) {
                const entries = states[key]
                if (!entries || !(address in entries)) continue
                const { [address]: _removed, ...rest } = entries
                states[key] = rest
                isChanged = true
            }
            if (isChanged) set({ states })
        },
        resetState: () => set({ states: {} }),
    }),
)

registerStore({
    name: 'account-chain-state-store',
    clearStorage: () => {},
    resetState: () => useAccountChainStateStore.getState().resetState(),
})

export const getAccountChainState = (
    scope: ChainScope,
    address: string,
): AccountChainState | undefined =>
    useAccountChainStateStore.getState().states[toScopeKey(scope)]?.[address]

// Narrows on the field, never on `family`, so no chain id leaks into shared code.
export const authorityAddressOf = (state: AccountChainState): string | null =>
    'authAddress' in state ? (state.authAddress ?? null) : null
