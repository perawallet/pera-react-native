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

import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { swapAdapterFor } from '../chain-adapter'
import { useSwapsStore } from '../store'

type UseSwapsResult = {
    fromAsset: string
    toAsset: string
    slippage: Nullable<string>
    isLocalCurrencyInput: boolean
    setFromAsset: (fromAsset: string) => void
    setToAsset: (toAsset: string, toAssetScope?: Nullable<ChainScope>) => void
    setSourceAsset: (chainId: ChainId, fromAsset: string) => void
    setSlippage: (slippage: Nullable<string>) => void
    setIsLocalCurrencyInput: (value: boolean) => void
    /** Restores the default pay/receive pair, keeping the user's settings. */
    resetAssetPair: () => void
}

export const useSwaps = (scope: ChainScope): UseSwapsResult => {
    const { nativeAssetId, defaultReceiveAssetId } = swapAdapterFor(scope)
    const fromAsset = useSwapsStore(state => state.fromAsset) ?? nativeAssetId
    // A pay asset picked on a new chain can be that chain's default receive asset.
    const toAsset =
        useSwapsStore(state => state.toAsset) ??
        (defaultReceiveAssetId === fromAsset
            ? nativeAssetId
            : defaultReceiveAssetId)
    const slippage = useSwapsStore(state => state.slippage)
    const isLocalCurrencyInput = useSwapsStore(
        state => state.isLocalCurrencyInput,
    )
    const setFromAsset = useSwapsStore(state => state.setFromAsset)
    const setToAsset = useSwapsStore(state => state.setToAsset)
    const setSourceAsset = useSwapsStore(state => state.setSourceAsset)
    const setSlippage = useSwapsStore(state => state.setSlippage)
    const setIsLocalCurrencyInput = useSwapsStore(
        state => state.setIsLocalCurrencyInput,
    )
    const resetAssetPair = useSwapsStore(state => state.resetState)

    return {
        fromAsset,
        toAsset,
        slippage,
        isLocalCurrencyInput,
        setFromAsset,
        setToAsset,
        setSourceAsset,
        setSlippage,
        setIsLocalCurrencyInput,
        resetAssetPair,
    }
}
