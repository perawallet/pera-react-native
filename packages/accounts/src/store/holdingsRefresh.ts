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
    /** Balances and fungible tokens. */
    failed: HoldingsRefreshFailures
    collectiblesFailed: HoldingsRefreshFailures
    setHoldingsRefreshFailed(
        scope: ChainScope,
        address: string,
        hasFailed: boolean,
    ): void
    setCollectiblesRefreshFailed(
        scope: ChainScope,
        address: string,
        hasFailed: boolean,
    ): void
    resetState(): void
}

// An unchanged flag keeps every reference, so a quiet sync tick gives
// subscribers nothing new.
const withFlag = (
    failures: HoldingsRefreshFailures,
    scope: ChainScope,
    address: string,
    hasFailed: boolean,
): HoldingsRefreshFailures => {
    const key = toScopeKey(scope)
    const held = failures[key]
    if ((held?.[address] === true) === hasFailed) return failures
    const { [address]: _previous, ...rest } = held ?? {}
    return {
        ...failures,
        [key]: hasFailed ? { ...rest, [address]: true } : rest,
    }
}

// In memory only: it describes the last sync of this process, and the next
// sync after a restart answers again.
export const useHoldingsRefreshStore = create<HoldingsRefreshStore>(set => ({
    failed: {},
    collectiblesFailed: {},
    setHoldingsRefreshFailed: (scope, address, hasFailed) =>
        set(prev => {
            const failed = withFlag(prev.failed, scope, address, hasFailed)
            return failed === prev.failed ? prev : { failed }
        }),
    setCollectiblesRefreshFailed: (scope, address, hasFailed) =>
        set(prev => {
            const collectiblesFailed = withFlag(
                prev.collectiblesFailed,
                scope,
                address,
                hasFailed,
            )
            return collectiblesFailed === prev.collectiblesFailed
                ? prev
                : { collectiblesFailed }
        }),
    resetState: () => set({ failed: {}, collectiblesFailed: {} }),
}))

registerStore({
    name: 'holdings-refresh-store',
    clearStorage: () => {},
    resetState: () => useHoldingsRefreshStore.getState().resetState(),
})
