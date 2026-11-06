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
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    guardedPersist,
    registerStore,
    type BaseStoreState,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

/**
 * Scope key, then account address, then the asset ids hidden there, each list
 * sorted so two devices holding the same set write the same JSON. A scope this
 * build doesn't register is kept as received.
 */
export type HiddenTokens = Record<string, Record<string, string[]>>

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
): readonly string[] => hiddenTokens[toScopeKey(scope)]?.[address] ?? []

// Rebuilt along one path so an unrelated scope or address keeps its reference.
const withToken = (
    hiddenTokens: HiddenTokens,
    { address, scope, assetId, isHidden }: SetTokenHiddenParams,
): HiddenTokens => {
    const scopeKey = toScopeKey(scope)
    const held = hiddenTokens[scopeKey]?.[address] ?? []
    if (held.includes(assetId) === isHidden) return hiddenTokens

    const next = isHidden
        ? [...held, assetId].sort()
        : held.filter(id => id !== assetId)
    const { [address]: _previous, ...otherAddresses } =
        hiddenTokens[scopeKey] ?? {}
    const addresses =
        next.length > 0
            ? { ...otherAddresses, [address]: next }
            : otherAddresses
    const { [scopeKey]: _scope, ...otherScopes } = hiddenTokens
    return Object.keys(addresses).length > 0
        ? { ...otherScopes, [scopeKey]: addresses }
        : otherScopes
}

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
