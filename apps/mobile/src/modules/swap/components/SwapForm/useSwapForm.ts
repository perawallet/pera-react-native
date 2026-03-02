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
import {
    USDC_ASSET_ID_MAINNET,
    USDC_ASSET_ID_TESTNET,
    getUsdcAssetId,
} from '@perawallet/wallet-core-assets'
import { useSwaps } from '@perawallet/wallet-core-swaps'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { useModalState } from '@hooks/useModalState'

type ModalState = ReturnType<typeof useModalState>

type UseSwapFormResult = {
    payAssetId: string
    receiveAssetId: string
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

const USDC_ASSET_IDS = [USDC_ASSET_ID_MAINNET, USDC_ASSET_ID_TESTNET]

export const useSwapForm = (): UseSwapFormResult => {
    const { network } = useNetwork()
    const { fromAsset, toAsset, setFromAsset, setToAsset } = useSwaps()
    const [payAmount, setPayAmount] = useState<Decimal | null>(null)
    const [receiveAmount, setReceiveAmount] = useState<Decimal | null>(null)
    const payAssetModal = useModalState()
    const receiveAssetModal = useModalState()
    const selectedAccount = useSelectedAccount()

    // If the stored toAsset is any USDC variant, correct it to the current network's USDC.
    // Any user-selected non-USDC asset is kept as-is.
    const receiveAssetId = USDC_ASSET_IDS.includes(toAsset)
        ? getUsdcAssetId(network)
        : toAsset

    const { data: payAssetBalance } = useAccountAssetBalanceQuery(
        selectedAccount ?? undefined,
        fromAsset,
    )
    const { data: receiveAssetBalance } = useAccountAssetBalanceQuery(
        selectedAccount ?? undefined,
        receiveAssetId,
    )

    const handlePayAmountChange = useCallback((amount: Decimal | null) => {
        setPayAmount(amount)
    }, [])

    const handleSwapDirection = useCallback(() => {
        setFromAsset(receiveAssetId)
        setToAsset(fromAsset)
        setPayAmount(receiveAmount)
        setReceiveAmount(payAmount)
    }, [
        fromAsset,
        receiveAssetId,
        payAmount,
        receiveAmount,
        setFromAsset,
        setToAsset,
    ])

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
        receiveAssetId,
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
