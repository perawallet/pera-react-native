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
import { PeraAssetVerificationTier } from '@perawallet/wallet-core-assets'
import {
    guardedPersist,
    registerStore,
    type BaseStoreState,
    type Maybe,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { canHideHolding } from '../chainProtocol'
import {
    assetIdsIn,
    unionTokenSets,
    withAssetIds,
    type TokenSets,
} from './tokenSets'

/**
 * Tokens each address keeps listed although Pera flags them suspicious: ones
 * the user unhid, swapped into, bought or sent. They still never count toward
 * a total.
 */
export type KeptTokens = TokenSets

export type SetTokenKeptParams = {
    address: string
    scope: ChainScope
    assetId: string
    isKept: boolean
}

export type KeepTokensParams = {
    address: string
    scope: ChainScope
    assetIds: readonly string[]
}

type KeptTokensData = { keptTokens: KeptTokens }

type KeptTokensActions = BaseStoreState & {
    setTokenKept: (params: SetTokenKeptParams) => void
    keepTokens: (params: KeepTokensParams) => void
    replaceKeptTokens: (keptTokens: KeptTokens) => void
    /** Adds every token `keptTokens` holds; nothing is ever un-kept, so a backup merges rather than replaces. */
    mergeKeptTokens: (keptTokens: KeptTokens) => void
}

export type KeptTokensState = KeptTokensData & KeptTokensActions

const STORE_NAME = 'kept-tokens-store'

const initialState: KeptTokensData = { keptTokens: {} }

export const keptAssetIdsOf = (
    keptTokens: KeptTokens,
    address: string,
    scope: ChainScope,
): readonly string[] => assetIdsIn(keptTokens, address, scope)

/**
 * Whether the asset list's default filter leaves this holding out: a token
 * Pera flags suspicious on a chain that receives tokens unasked, which its
 * address hasn't kept.
 */
export const isAutoHiddenHolding = (
    holding: {
        address: string
        scope: ChainScope
        assetId: string
        asset?: Maybe<{ peraMetadata?: Maybe<{ verificationTier?: string }> }>
    },
    keptTokens: KeptTokens,
): boolean =>
    holding.asset?.peraMetadata?.verificationTier ===
        PeraAssetVerificationTier.suspicious &&
    canHideHolding(holding.scope.chainId, holding.assetId) &&
    !keptAssetIdsOf(keptTokens, holding.address, holding.scope).includes(
        holding.assetId,
    )

export const useKeptTokensStore: UseBoundStore<
    WithPersist<StoreApi<KeptTokensState>, unknown>
> = create<KeptTokensState>()(
    guardedPersist(
        set => {
            const update = (
                params: Parameters<typeof withAssetIds>[1],
            ): void => {
                set(state => {
                    const keptTokens = withAssetIds(state.keptTokens, params)
                    return keptTokens === state.keptTokens
                        ? state
                        : { keptTokens }
                })
            }
            return {
                ...initialState,
                setTokenKept: ({ assetId, isKept, ...path }) =>
                    update({
                        ...path,
                        assetIds: [assetId],
                        isIncluded: isKept,
                    }),
                keepTokens: params => update({ ...params, isIncluded: true }),
                replaceKeptTokens: keptTokens => set({ keptTokens }),
                mergeKeptTokens: incoming =>
                    set(state => {
                        const keptTokens = unionTokenSets(
                            state.keptTokens,
                            incoming,
                        )
                        return keptTokens === state.keptTokens
                            ? state
                            : { keptTokens }
                    }),
                resetState: () => set(initialState),
            }
        },
        {
            name: STORE_NAME,
            storage: () => getProvider().keyValueStorage,
            version: 1,
            partialize: state => ({ keptTokens: state.keptTokens }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    // Zustand's persist middleware exposes `.persist` at runtime, but the bound
    // store's types don't include it.
    clearStorage: () =>
        (
            useKeptTokensStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useKeptTokensStore.getState().resetState(),
})
