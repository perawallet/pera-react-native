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
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { SwapFlippedPayAmount, SwapsState } from '../models'
import {
    guardedPersist,
    registerStore,
    type WithPersist,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'swaps-store'

// null resolves to the chain adapter's default pair; see useSwaps.
const initialState = {
    fromAsset: null as Nullable<string>,
    toAsset: null as Nullable<string>,
    toAssetScope: null as Nullable<ChainScope>,
    receivingAccountId: null as Nullable<string>,
    sourceChainId: null as Nullable<ChainId>,
    accountId: null as Nullable<string>,
    pairAccountId: null as Nullable<string>,
    slippage: null as Nullable<string>,
    isLocalCurrencyInput: false,
    flippedPayAmount: null as Nullable<SwapFlippedPayAmount>,
}

export const useSwapsStore: UseBoundStore<
    WithPersist<StoreApi<SwapsState>, unknown>
> = create<SwapsState>()(
    guardedPersist(
        (set, get) => ({
            ...initialState,
            setFromAsset: (fromAsset: string) => set({ fromAsset }),
            setToAsset: (
                toAsset: string,
                toAssetScope: Nullable<ChainScope> = null,
            ) => set({ toAsset, toAssetScope }),
            setReceivingAccountId: (receivingAccountId: Nullable<string>) =>
                set({ receivingAccountId }),
            setAccountId: (accountId: Nullable<string>) => set({ accountId }),
            setSourceChainId: (sourceChainId: Nullable<ChainId>) =>
                set({
                    sourceChainId,
                    fromAsset: null,
                    toAsset: null,
                    toAssetScope: null,
                    receivingAccountId: null,
                    pairAccountId: null,
                    flippedPayAmount: null,
                }),
            setSourceAsset: (sourceChainId: ChainId, fromAsset: string) =>
                set({
                    sourceChainId,
                    fromAsset,
                    toAsset: null,
                    toAssetScope: null,
                    receivingAccountId: null,
                    pairAccountId: null,
                    flippedPayAmount: null,
                }),
            setAccountPair: ({
                accountId,
                chainId,
                fromAsset,
                toAsset,
                toAssetScope,
            }) =>
                set({
                    sourceChainId: chainId,
                    fromAsset,
                    toAsset: toAsset ?? null,
                    toAssetScope: toAssetScope ?? null,
                    receivingAccountId: null,
                    accountId,
                    pairAccountId: accountId,
                    flippedPayAmount: null,
                }),
            flipAcrossChains: flip =>
                set({
                    sourceChainId: flip.sourceChainId,
                    fromAsset: flip.fromAsset,
                    toAsset: flip.toAsset,
                    toAssetScope: flip.toAssetScope,
                    receivingAccountId: null,
                    flippedPayAmount: flip.payAmount
                        ? {
                              chainId: flip.sourceChainId,
                              assetId: flip.fromAsset,
                              amount: flip.payAmount,
                          }
                        : null,
                }),
            takeFlippedPayAmount: (chainId, assetId) => {
                const { flippedPayAmount } = get()
                if (
                    flippedPayAmount?.chainId !== chainId ||
                    flippedPayAmount.assetId !== assetId
                ) {
                    return null
                }
                set({ flippedPayAmount: null })
                return flippedPayAmount.amount
            },
            setSlippage: (slippage: Nullable<string>) => set({ slippage }),
            setIsLocalCurrencyInput: (value: boolean) =>
                set({ isLocalCurrencyInput: value }),
            resetAssetPair: () =>
                set(state => ({
                    ...initialState,
                    accountId: state.accountId,
                    slippage: state.slippage,
                    isLocalCurrencyInput: state.isLocalCurrencyInput,
                })),
            resetState: () =>
                set(state => ({
                    ...initialState,
                    slippage: state.slippage,
                    isLocalCurrencyInput: state.isLocalCurrencyInput,
                })),
        }),
        {
            name: STORE_NAME,
            storage: () => getProvider().keyValueStorage,
            partialize: state => ({
                slippage: state.slippage,
                isLocalCurrencyInput: state.isLocalCurrencyInput,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useSwapsStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useSwapsStore.getState().resetState(),
})
