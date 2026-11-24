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
import { assetIdsIn, withAssetIds, type TokenSets } from './tokenSets'

/** The asset ids each address hid, per scope. */
export type HiddenTokens = TokenSets

export type SetTokenHiddenParams = {
    address: string
    scope: ChainScope
    assetId: string
    isHidden: boolean
}

type HiddenTokensData = { hiddenTokens: HiddenTokens }

type HiddenTokensActions = BaseStoreState & {
    setTokenHidden: (params: SetTokenHiddenParams) => void
    replaceHiddenTokens: (hiddenTokens: HiddenTokens) => void
}

export type HiddenTokensState = HiddenTokensData & HiddenTokensActions

const STORE_NAME = 'hidden-tokens-store'

const initialState: HiddenTokensData = { hiddenTokens: {} }

export const hiddenAssetIdsOf = (
    hiddenTokens: HiddenTokens,
    address: string,
    scope: ChainScope,
): readonly string[] => assetIdsIn(hiddenTokens, address, scope)

const withToken = (
    hiddenTokens: HiddenTokens,
    { address, scope, assetId, isHidden }: SetTokenHiddenParams,
): HiddenTokens =>
    withAssetIds(hiddenTokens, {
        address,
        scope,
        assetIds: [assetId],
        isIncluded: isHidden,
    })

export const useHiddenTokensStore: UseBoundStore<
    WithPersist<StoreApi<HiddenTokensState>, unknown>
> = create<HiddenTokensState>()(
    guardedPersist(
        set => ({
            ...initialState,
            setTokenHidden: params => {
                set(state => {
                    const hiddenTokens = withToken(state.hiddenTokens, params)
                    return hiddenTokens === state.hiddenTokens
                        ? state
                        : { hiddenTokens }
                })
            },
            replaceHiddenTokens: hiddenTokens => set({ hiddenTokens }),
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: () => getProvider().keyValueStorage,
            version: 1,
            partialize: state => ({ hiddenTokens: state.hiddenTokens }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    // Zustand's persist middleware exposes `.persist` at runtime, but the bound
    // store's types don't include it.
    clearStorage: () =>
        (
            useHiddenTokensStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useHiddenTokensStore.getState().resetState(),
})
