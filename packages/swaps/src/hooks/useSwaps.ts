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

import { useSwapsStore } from '../store'
import type { Nullable } from '@perawallet/wallet-core-shared'

type UseSwapsResult = {
    fromAsset: string
    toAsset: string
    slippage: Nullable<string>
    isLocalCurrencyInput: boolean
    setFromAsset: (fromAsset: string) => void
    setToAsset: (toAsset: string) => void
    setSlippage: (slippage: Nullable<string>) => void
    setIsLocalCurrencyInput: (value: boolean) => void
}

export const useSwaps = (): UseSwapsResult => {
    const fromAsset = useSwapsStore(state => state.fromAsset)
    const toAsset = useSwapsStore(state => state.toAsset)
    const slippage = useSwapsStore(state => state.slippage)
    const isLocalCurrencyInput = useSwapsStore(
        state => state.isLocalCurrencyInput,
    )
    const setFromAsset = useSwapsStore(state => state.setFromAsset)
    const setToAsset = useSwapsStore(state => state.setToAsset)
    const setSlippage = useSwapsStore(state => state.setSlippage)
    const setIsLocalCurrencyInput = useSwapsStore(
        state => state.setIsLocalCurrencyInput,
    )

    return {
        fromAsset,
        toAsset,
        slippage,
        isLocalCurrencyInput,
        setFromAsset,
        setToAsset,
        setSlippage,
        setIsLocalCurrencyInput,
    }
}
