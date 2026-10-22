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
import {
    toScopeKey,
    type ChainScope,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import { registerStore } from '@perawallet/wallet-core-shared'

/** Scope key, then address: present while that account's last sync left holdings unrefreshed. */
export type HoldingsRefreshFailures = Partial<
    Record<ChainScopeKey, Readonly<Record<string, true>>>
>

export type HoldingsRefreshStore = {
    failed: HoldingsRefreshFailures
    setHoldingsRefreshFailed(
        scope: ChainScope,
        address: string,
        hasFailed: boolean,
    ): void
    resetState(): void
}

// In memory only: it describes the last sync of this process, and the next
// sync after a restart answers again.
export const useHoldingsRefreshStore = create<HoldingsRefreshStore>(
    (set, get) => ({
        failed: {},
        // An unchanged flag keeps every reference, so a quiet sync tick gives
        // subscribers nothing new.
        setHoldingsRefreshFailed: (scope, address, hasFailed) => {
            const key = toScopeKey(scope)
            const held = get().failed[key]
            if ((held?.[address] === true) === hasFailed) return
            const { [address]: _previous, ...rest } = held ?? {}
            set(prev => ({
                failed: {
                    ...prev.failed,
                    [key]: hasFailed ? { ...rest, [address]: true } : rest,
                },
            }))
        },
        resetState: () => set({ failed: {} }),
    }),
)

registerStore({
    name: 'holdings-refresh-store',
    clearStorage: () => {},
    resetState: () => useHoldingsRefreshStore.getState().resetState(),
})
