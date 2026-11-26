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

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    guardedPersist,
    registerStore,
    type BaseStoreState,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { withAssetIds, type TokenSets } from './tokenSets'

/**
 * Listed tokens each address has held a balance of. Add-only: a token Pera
 * later delists is still one the account held, so a notification service keyed
 * on it keeps following it.
 */
export type HeldListedTokens = TokenSets

export type AddHeldListedTokensParams = {
    address: string
    scope: ChainScope
    assetIds: readonly string[]
}

type HeldListedTokensData = { heldListedTokens: HeldListedTokens }

type HeldListedTokensActions = BaseStoreState & {
    addHeldListedTokens: (params: AddHeldListedTokensParams) => void
}

export type HeldListedTokensState = HeldListedTokensData &
    HeldListedTokensActions

const STORE_NAME = 'held-listed-tokens-store'

const initialState: HeldListedTokensData = { heldListedTokens: {} }

export const useHeldListedTokensStore: UseBoundStore<
    WithPersist<StoreApi<HeldListedTokensState>, unknown>
> = create<HeldListedTokensState>()(
    guardedPersist(
        (set, get) => ({
            ...initialState,
            // Persist writes on every `set`, and a chain's balance read calls this
            // each sync, so a call that adds nothing must not reach `set`.
            addHeldListedTokens: params => {
                const current = get().heldListedTokens
                const next = withAssetIds(current, {
                    ...params,
                    isIncluded: true,
                })
                if (next !== current) set({ heldListedTokens: next })
            },
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: () => getProvider().keyValueStorage,
            version: 1,
            partialize: state => ({
                heldListedTokens: state.heldListedTokens,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    // Zustand's persist middleware exposes `.persist` at runtime, but the bound
    // store's types don't include it.
    clearStorage: () =>
        (
            useHeldListedTokensStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useHeldListedTokensStore.getState().resetState(),
})
