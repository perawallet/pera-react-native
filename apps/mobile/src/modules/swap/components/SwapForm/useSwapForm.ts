/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useState, useCallback } from 'react'
import Decimal from 'decimal.js'
import {
    AssetWithAccountBalance,
    useAccountAssetBalanceQuery,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useSwaps } from '@perawallet/wallet-core-swaps'
import { useModalState } from '@hooks/useModalState'

type ModalState = ReturnType<typeof useModalState>

type UseSwapFormResult = {
    payAssetId: string
    toAsset: string
    payAmount: Decimal | null
    receiveAmount: Decimal | null
    payBalance: Decimal | null
    receiveBalance: Decimal | null
    payAssetModal: ModalState
    receiveAssetModal: ModalState
    handlePayAmountChange: (amount: Decimal | null) => void
    handleSwapDirection: () => void
    handleMaxPress: () => void
    handlePayAssetSelected: (asset: AssetWithAccountBalance) => void
    handleReceiveAssetSelected: (asset: AssetWithAccountBalance) => void
}

export const useSwapForm = (): UseSwapFormResult => {
    const { fromAsset, toAsset, setFromAsset, setToAsset } = useSwaps()
    const [payAmount, setPayAmount] = useState<Decimal | null>(null)
    const [receiveAmount, setReceiveAmount] = useState<Decimal | null>(null)
    const payAssetModal = useModalState()
    const receiveAssetModal = useModalState()
    const selectedAccount = useSelectedAccount()

    const { data: payAssetBalance } = useAccountAssetBalanceQuery(
        selectedAccount ?? undefined,
        fromAsset,
    )
    const { data: receiveAssetBalance } = useAccountAssetBalanceQuery(
        selectedAccount ?? undefined,
        toAsset,
    )

    const handlePayAmountChange = useCallback((amount: Decimal | null) => {
        setPayAmount(amount)
    }, [])

    const handleSwapDirection = useCallback(() => {
        setFromAsset(toAsset)
        setToAsset(fromAsset)
        setPayAmount(receiveAmount)
        setReceiveAmount(payAmount)
    }, [fromAsset, toAsset, payAmount, receiveAmount, setFromAsset, setToAsset])

    const handleMaxPress = useCallback(() => {
        setPayAmount(payAssetBalance?.amount ?? null)
    }, [payAssetBalance?.amount])

    const handlePayAssetSelected = useCallback(
        (asset: AssetWithAccountBalance) => {
            setFromAsset(asset.assetId)
        },
        [setFromAsset],
    )

    const handleReceiveAssetSelected = useCallback(
        (asset: AssetWithAccountBalance) => {
            setToAsset(asset.assetId)
        },
        [setToAsset],
    )

    return {
        payAssetId: fromAsset,
        toAsset,
        payAmount,
        receiveAmount,
        payBalance: payAssetBalance?.amount ?? null,
        receiveBalance: receiveAssetBalance?.amount ?? null,
        payAssetModal,
        receiveAssetModal,
        handlePayAmountChange,
        handleSwapDirection,
        handleMaxPress,
        handlePayAssetSelected,
        handleReceiveAssetSelected,
    }
}
