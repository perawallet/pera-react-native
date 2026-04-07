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

import { useState, useCallback, useRef } from 'react'
import { Decimal } from 'decimal.js'
import {
    AssetWithAccountBalance,
    useAccountAssetBalanceQuery,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import { baseUnitsToDisplayUnits } from '@perawallet/wallet-core-blockchain'
import {
    useCalculateSwapAmountMutation,
    useSwaps,
    type SwapConfigurationResult,
} from '@perawallet/wallet-core-swaps'
import { useCurrency } from '@perawallet/wallet-core-currencies'
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
    configModal: ModalState
    handlePayAmountChange: (amount: Decimal | null) => void
    handleSwapDirection: () => void
    handleMaxPress: () => void
    handlePayAssetSelected: (asset: AssetWithAccountBalance) => void
    handleReceiveAssetSelected: (asset: AssetWithAccountBalance) => void
    handleConfigApply: (result: SwapConfigurationResult) => void
}

export const useSwapForm = (): UseSwapFormResult => {
    const { fromAsset, toAsset, setFromAsset, setToAsset, setSlippage } =
        useSwaps()
    const { preferredCurrency, setPreferredCurrency, fallbackCurrency } =
        useCurrency()
    const [payAmount, setPayAmount] = useState<Decimal | null>(null)
    const [receiveAmount, setReceiveAmount] = useState<Decimal | null>(null)
    const payAssetModal = useModalState()
    const receiveAssetModal = useModalState()
    const configModal = useModalState()
    const selectedAccount = useSelectedAccount()
    const { mutateAsync: calculateSwapAmount } =
        useCalculateSwapAmountMutation()
    const calculateSwapAmountRef = useRef(calculateSwapAmount)
    calculateSwapAmountRef.current = calculateSwapAmount

    const { data: payAssets } = useAssetsQuery([fromAsset])
    const payAsset = payAssets?.get(fromAsset)

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

    const applyPercentageAmount = useCallback(
        async (percentage: number) => {
            if (!selectedAccount) return
            if (!payAssetBalance?.amount || payAssetBalance.amount.isZero())
                return
            try {
                const result = await calculateSwapAmountRef.current!({
                    address: selectedAccount.address,
                    asset_in_id: Number(fromAsset),
                    asset_out_id: Number(toAsset),
                    percentage: String(percentage / 100),
                })
                if (result.amount) {
                    const displayAmount = baseUnitsToDisplayUnits(
                        result.amount,
                        payAsset?.decimals ?? 0,
                    )
                    setPayAmount(displayAmount)
                }
            } catch {
                // API error is already logged by the query client
            }
        },
        [selectedAccount, fromAsset, toAsset, payAsset, payAssetBalance],
    )

    const handleMaxPress = useCallback(() => {
        void applyPercentageAmount(100)
    }, [applyPercentageAmount])

    const handlePayAssetSelected = useCallback(
        (asset: AssetWithAccountBalance) => {
            setFromAsset(asset.assetId)
            setPayAmount(null)
            setReceiveAmount(null)
        },
        [setFromAsset],
    )

    const handleReceiveAssetSelected = useCallback(
        (asset: AssetWithAccountBalance) => {
            setToAsset(asset.assetId)
            setReceiveAmount(null)
        },
        [setToAsset],
    )

    const handleConfigApply = useCallback(
        (result: SwapConfigurationResult) => {
            if (result.slippageTolerance !== null) {
                setSlippage(result.slippageTolerance)
            }

            const isAlgoPreferred = preferredCurrency === 'ALGO'
            if (result.useLocalCurrency && isAlgoPreferred) {
                setPreferredCurrency(fallbackCurrency)
            } else if (!result.useLocalCurrency && !isAlgoPreferred) {
                setPreferredCurrency('ALGO')
            }

            if (result.balancePercentage !== null) {
                void applyPercentageAmount(result.balancePercentage)
            }
        },
        [
            setSlippage,
            preferredCurrency,
            setPreferredCurrency,
            fallbackCurrency,
            applyPercentageAmount,
        ],
    )

    return {
        payAssetId: fromAsset,
        receiveAssetId: toAsset,
        payAmount,
        receiveAmount,
        payBalance: payAssetBalance?.amount ?? null,
        receiveBalance: receiveAssetBalance?.amount ?? null,
        payAssetModal,
        receiveAssetModal,
        configModal,
        handlePayAmountChange,
        handleSwapDirection,
        handleMaxPress,
        handlePayAssetSelected,
        handleReceiveAssetSelected,
        handleConfigApply,
    }
}
