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
import { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { useModalState } from '@hooks/useModalState'

type ModalState = ReturnType<typeof useModalState>

type UseSwapFormResult = {
    payAssetId: string | null
    receiveAssetId: string | null
    payAmount: string
    receiveAmount: string
    payBalance: string
    receiveBalance: string
    payAssetModal: ModalState
    receiveAssetModal: ModalState
    handlePayAmountChange: (amount: string) => void
    handleSwapDirection: () => void
    handleMaxPress: () => void
    handlePayAssetSelected: (asset: AssetWithAccountBalance) => void
    handleReceiveAssetSelected: (asset: AssetWithAccountBalance) => void
}

export const useSwapForm = (): UseSwapFormResult => {
    const [payAssetId, setPayAssetId] = useState<string | null>(null)
    const [receiveAssetId, setReceiveAssetId] = useState<string | null>(null)
    const [payAmount, setPayAmount] = useState('0.00')
    const [receiveAmount, setReceiveAmount] = useState('0.00')
    const payAssetModal = useModalState()
    const receiveAssetModal = useModalState()

    const handlePayAmountChange = useCallback((amount: string) => {
        setPayAmount(amount)
    }, [])

    const handleSwapDirection = useCallback(() => {
        setPayAssetId(receiveAssetId)
        setReceiveAssetId(payAssetId)
        setPayAmount(receiveAmount)
        setReceiveAmount(payAmount)
    }, [payAssetId, receiveAssetId, payAmount, receiveAmount])

    const handleMaxPress = useCallback(() => {
        // No-op until balance data is available from API
    }, [])

    const handlePayAssetSelected = useCallback(
        (asset: AssetWithAccountBalance) => {
            setPayAssetId(asset.assetId)
        },
        [],
    )

    const handleReceiveAssetSelected = useCallback(
        (asset: AssetWithAccountBalance) => {
            setReceiveAssetId(asset.assetId)
        },
        [],
    )

    return {
        payAssetId,
        receiveAssetId,
        payAmount,
        receiveAmount,
        payBalance: '',
        receiveBalance: '',
        payAssetModal,
        receiveAssetModal,
        handlePayAmountChange,
        handleSwapDirection,
        handleMaxPress,
        handlePayAssetSelected,
        handleReceiveAssetSelected,
    }
}
