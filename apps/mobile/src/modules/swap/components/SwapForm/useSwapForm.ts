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

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Decimal } from 'decimal.js'
import {
    AssetWithAccountBalance,
    useAccountAssetBalanceQuery,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import {
    baseUnitsToDisplayUnits,
    displayUnitsToBaseUnits,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import {
    useCalculateSwapAmountMutation,
    useCreateQuotesMutation,
    useSwaps,
    type SwapQuote,
    type SwapConfigurationResult,
} from '@perawallet/wallet-core-swaps'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { isDecimalEqual } from '@perawallet/wallet-core-shared'
import { useModalState } from '@hooks/useModalState'
import { useDebouncedValue } from '@hooks/useDebouncedValue'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import {
    useSwapExecution,
    type SwapExecutionStatus,
} from '../../hooks/useSwapExecution'

type ModalState = ReturnType<typeof useModalState>

type UseSwapFormResult = {
    payAssetId: string
    receiveAssetId: string
    payAmount: Decimal | null
    receiveAmount: Decimal | null
    payBalance: Decimal | null
    receiveBalance: Decimal | null
    isQuoteFetching: boolean
    isQuoteError: boolean
    selectedQuote: SwapQuote | null
    canSwap: boolean
    swapStatus: SwapExecutionStatus
    payAssetModal: ModalState
    receiveAssetModal: ModalState
    configModal: ModalState
    confirmModal: ModalState
    handlePayAmountChange: (amount: Decimal | null) => void
    handleSwapDirection: () => void
    handleMaxPress: () => void
    handlePayAssetSelected: (asset: AssetWithAccountBalance) => void
    handleReceiveAssetSelected: (asset: AssetWithAccountBalance) => void
    handleConfigApply: (result: SwapConfigurationResult) => void
    handleConfirmSwap: () => void
}

const QUOTE_DEBOUNCE_MS = 500

export const useSwapForm = (): UseSwapFormResult => {
    const {
        fromAsset,
        toAsset,
        slippage,
        setFromAsset,
        setToAsset,
        setSlippage,
    } = useSwaps()
    const { network } = useNetwork()
    const { preferredCurrency, setPreferredCurrency, fallbackCurrency } =
        useCurrency()
    const [payAmount, setPayAmount] = useState<Decimal | null>(null)
    const [receiveAmount, setReceiveAmount] = useState<Decimal | null>(null)
    const [selectedQuote, setSelectedQuote] = useState<SwapQuote | null>(null)
    const payAssetModal = useModalState()
    const receiveAssetModal = useModalState()
    const configModal = useModalState()
    const confirmModal = useModalState()
    const selectedAccount = useSelectedAccount()
    const deviceId = useDeviceID(network)
    const { mutateAsync: calculateSwapAmount } =
        useCalculateSwapAmountMutation()
    const calculateSwapAmountRef = useRef(calculateSwapAmount)
    calculateSwapAmountRef.current = calculateSwapAmount

    const {
        mutateAsync: createQuotes,
        isPending: isQuoteLoading,
        isError: isQuoteError,
        reset: resetQuoteMutation,
    } = useCreateQuotesMutation()
    const createQuotesRef = useRef(createQuotes)
    createQuotesRef.current = createQuotes

    const swapExecution = useSwapExecution()
    const { successToast } = useToast()
    const { t } = useLanguage()

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

    const debouncedPayAmount = useDebouncedValue(
        payAmount,
        QUOTE_DEBOUNCE_MS,
        isDecimalEqual,
    )

    const isDebouncing = !isDecimalEqual(payAmount, debouncedPayAmount)
    const hasUnresolvedQuote =
        payAmount !== null &&
        !payAmount.isZero() &&
        !payAmount.isNeg() &&
        receiveAmount === null &&
        !isQuoteError
    const isQuoteFetching = isQuoteLoading || isDebouncing || hasUnresolvedQuote

    const fromAssetRef = useRef(fromAsset)
    fromAssetRef.current = fromAsset
    const toAssetRef = useRef(toAsset)
    toAssetRef.current = toAsset
    const payAssetDecimalsRef = useRef(payAsset?.decimals)
    payAssetDecimalsRef.current = payAsset?.decimals

    useEffect(() => {
        if (
            !selectedAccount ||
            !debouncedPayAmount ||
            debouncedPayAmount.isZero() ||
            debouncedPayAmount.isNeg()
        ) {
            setReceiveAmount(null)
            setSelectedQuote(null)
            return
        }

        const amountInBaseUnits = displayUnitsToBaseUnits(
            debouncedPayAmount,
            payAssetDecimalsRef.current ?? 0,
        )

        let cancelled = false

        const fetchQuotes = async () => {
            try {
                const result = await createQuotesRef.current({
                    swapper_address: selectedAccount.address,
                    swap_type: 'fixed-input',
                    asset_in_id: Number(fromAssetRef.current),
                    asset_out_id: Number(toAssetRef.current),
                    amount: amountInBaseUnits.toFixed(0),
                    slippage: slippage ?? undefined,
                    device: deviceId ?? null,
                })

                if (cancelled) return

                const best = result.reduce<SwapQuote | null>((prev, curr) => {
                    if (!curr.amountOut) return prev
                    if (!prev?.amountOut) return curr
                    return curr.amountOut.greaterThan(prev.amountOut)
                        ? curr
                        : prev
                }, null)

                setSelectedQuote(best)

                if (best?.amountOut) {
                    const receiveDecimals = best.assetOut.decimals ?? 0
                    setReceiveAmount(
                        baseUnitsToDisplayUnits(
                            best.amountOut,
                            receiveDecimals,
                        ),
                    )
                } else {
                    setReceiveAmount(null)
                }
            } catch {
                if (cancelled) return
                setReceiveAmount(null)
                setSelectedQuote(null)
            }
        }

        void fetchQuotes()

        return () => {
            cancelled = true
        }
    }, [debouncedPayAmount, slippage, selectedAccount, deviceId])

    const canSwap = useMemo(
        () =>
            selectedQuote !== null &&
            payAmount !== null &&
            payAmount.greaterThan(0) &&
            !isQuoteFetching,
        [selectedQuote, payAmount, isQuoteFetching],
    )

    const handlePayAmountChange = useCallback((amount: Decimal | null) => {
        setPayAmount(amount)
    }, [])

    const handleSwapDirection = useCallback(() => {
        setFromAsset(toAsset)
        setToAsset(fromAsset)
        setPayAmount(receiveAmount)
        setReceiveAmount(payAmount)
        setSelectedQuote(null)
        resetQuoteMutation()
    }, [
        fromAsset,
        toAsset,
        payAmount,
        receiveAmount,
        setFromAsset,
        setToAsset,
        resetQuoteMutation,
    ])

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
            setSelectedQuote(null)
            resetQuoteMutation()
        },
        [setFromAsset, resetQuoteMutation],
    )

    const handleReceiveAssetSelected = useCallback(
        (asset: AssetWithAccountBalance) => {
            setToAsset(asset.assetId)
            setReceiveAmount(null)
            setSelectedQuote(null)
            resetQuoteMutation()
        },
        [setToAsset, resetQuoteMutation],
    )

    const handleConfirmSwap = useCallback(async () => {
        if (!selectedQuote?.quoteIdStr) return
        const success = await swapExecution.execute(selectedQuote.quoteIdStr)
        if (success) {
            confirmModal.close()
            successToast(
                t('swap.execution.success_title'),
                t('swap.execution.success_body', {
                    fromAsset: selectedQuote.assetIn.unitName ?? '',
                    toAsset: selectedQuote.assetOut.unitName ?? '',
                }),
            )
            setPayAmount(null)
            setReceiveAmount(null)
            setSelectedQuote(null)
            resetQuoteMutation()
        }
    }, [
        selectedQuote,
        confirmModal,
        swapExecution,
        successToast,
        t,
        resetQuoteMutation,
    ])

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
        isQuoteFetching,
        isQuoteError,
        selectedQuote,
        canSwap,
        swapStatus: swapExecution.status,
        payAssetModal,
        receiveAssetModal,
        configModal,
        confirmModal,
        handlePayAmountChange,
        handleSwapDirection,
        handleMaxPress,
        handlePayAssetSelected,
        handleReceiveAssetSelected,
        handleConfigApply,
        handleConfirmSwap,
    }
}
