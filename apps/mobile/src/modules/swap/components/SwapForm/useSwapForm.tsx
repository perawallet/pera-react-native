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

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { type Decimal } from 'decimal.js'
import {
    useAccountAssetBalanceQuery,
    useAccountBalancesInvalidator,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import { trackEvent, SwapEvent, AnalyticsMetadataKey } from '@analytics'
import { baseUnitsToDisplayUnits } from '@perawallet/wallet-core-blockchain'
import {
    useCalculateSwapAmountMutation,
    usePrefetchProviders,
    useSwaps,
    type SwapQuote,
    type SwapConfigurationResult,
} from '@perawallet/wallet-core-swaps'
import {
    isDecimalEqual,
    uint64IdToNumber,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { pickBestByAmountOut } from '../../hooks/swapQuoteHelpers'
import { useSwapQuotes } from '../../hooks/useSwapQuotes'
import { SwapAssetSelectionContent } from '../SwapAssetSelectionContent'
import { SwapConfigurationContent } from '../SwapConfigurationContent'
import {
    SwapConfirmationContent,
    type SwapConfirmationResult,
} from '../SwapConfirmationContent'
import {
    SwapProviderContent,
    type SwapProviderResult,
} from '../SwapProviderContent'

type UseSwapFormResult = {
    payAssetId: string
    receiveAssetId: string
    payAmount: Nullable<Decimal>
    receiveAmount: Nullable<Decimal>
    payBalance: Nullable<Decimal>
    receiveBalance: Nullable<Decimal>
    isQuoteFetching: boolean
    isQuoteError: boolean
    selectedQuote: Nullable<SwapQuote>
    providerSelectionMode: 'auto' | 'manual'
    canSwap: boolean
    isLocalCurrencyInput: boolean
    handlePayAmountChange: (amount: Nullable<Decimal>) => void
    handleSwapDirection: () => void
    handleMaxPress: () => void
    handleOpenPayAssetSelection: () => void
    handleOpenReceiveAssetSelection: () => void
    handleOpenConfig: () => void
    handleOpenProvider: () => void
    handleOpenConfirm: () => void
}

export const useSwapForm = (): UseSwapFormResult => {
    const {
        fromAsset,
        toAsset,
        slippage,
        isLocalCurrencyInput,
        setFromAsset,
        setToAsset,
        setSlippage,
        setIsLocalCurrencyInput,
    } = useSwaps()
    const [payAmount, setPayAmount] = useState<Nullable<Decimal>>(null)
    const [receiveAmount, setReceiveAmount] = useState<Nullable<Decimal>>(null)
    const [selectedProviderName, setSelectedProviderName] =
        useState<Nullable<string>>(null)
    const { request: requestBottomSheet } = useBottomSheet()
    const selectedAccount = useSelectedAccount()
    const prefetchProviders = usePrefetchProviders()

    useEffect(() => {
        prefetchProviders()
    }, [prefetchProviders])

    const { mutateAsync: calculateSwapAmount } =
        useCalculateSwapAmountMutation()
    const calculateSwapAmountRef = useRef(calculateSwapAmount)
    calculateSwapAmountRef.current = calculateSwapAmount

    const { invalidate: invalidateAccountBalances } =
        useAccountBalancesInvalidator()
    const { successToast, errorToast, infoToast } = useToast()
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

    const {
        allQuotes,
        quotedAmount,
        isQuoteFetching,
        isQuoteError,
        reset: resetQuotes,
        refresh: refreshQuotes,
    } = useSwapQuotes({
        swapperAddress: selectedAccount?.address ?? null,
        fromAssetId: fromAsset,
        toAssetId: toAsset,
        payAmount,
        payDecimals: payAsset?.decimals ?? null,
        slippage,
    })

    const bestQuote = useMemo(() => pickBestByAmountOut(allQuotes), [allQuotes])

    // When a manually selected provider drops from the latest quote set, fall
    // back to the best quote for display and reset selection state to null so
    // providerSelectionMode reports 'auto'.
    const selectedQuote = useMemo<Nullable<SwapQuote>>(() => {
        if (selectedProviderName === null) return bestQuote
        const match = allQuotes.find(
            quote => quote.provider === selectedProviderName,
        )
        return match ?? bestQuote
    }, [allQuotes, selectedProviderName, bestQuote])

    const providerSelectionMode: 'auto' | 'manual' = useMemo(() => {
        if (selectedProviderName === null) return 'auto'
        const matchExists = allQuotes.some(
            quote => quote.provider === selectedProviderName,
        )
        return matchExists ? 'manual' : 'auto'
    }, [allQuotes, selectedProviderName])

    useEffect(() => {
        if (selectedProviderName === null) return
        const matchExists = allQuotes.some(
            quote => quote.provider === selectedProviderName,
        )
        if (!matchExists) setSelectedProviderName(null)
    }, [allQuotes, selectedProviderName])

    useEffect(() => {
        if (!selectedQuote?.amountOut) {
            setReceiveAmount(null)
            return
        }
        const receiveDecimals = selectedQuote.assetOut.decimals ?? 0
        setReceiveAmount(
            baseUnitsToDisplayUnits(selectedQuote.amountOut, receiveDecimals),
        )
    }, [selectedQuote])

    const canSwap = useMemo(
        () =>
            selectedQuote !== null &&
            payAmount !== null &&
            payAmount.greaterThan(0) &&
            !isQuoteFetching,
        [selectedQuote, payAmount, isQuoteFetching],
    )

    const handlePayAmountChange = useCallback(
        (amount: Nullable<Decimal>) => {
            setPayAmount(amount)
            if (!isDecimalEqual(amount, quotedAmount)) {
                resetQuotes()
                setReceiveAmount(null)
            }
        },
        [quotedAmount, resetQuotes],
    )

    const handleSwapDirection = useCallback(() => {
        setFromAsset(toAsset)
        setToAsset(fromAsset)
        setPayAmount(receiveAmount)
        setReceiveAmount(payAmount)
        setSelectedProviderName(null)
        resetQuotes()
    }, [
        fromAsset,
        toAsset,
        payAmount,
        receiveAmount,
        setFromAsset,
        setToAsset,
        resetQuotes,
    ])

    const applyPercentageAmount = useCallback(
        async (percentage: number) => {
            if (!selectedAccount) return
            if (!payAssetBalance?.amount || payAssetBalance.amount.isZero())
                return
            try {
                const result = await calculateSwapAmountRef.current!({
                    address: selectedAccount.address,
                    asset_in_id: uint64IdToNumber(fromAsset),
                    asset_out_id: uint64IdToNumber(toAsset),
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

    const handleOpenPayAssetSelection = useCallback(async () => {
        trackEvent(SwapEvent.SelectFromToken, {
            [AnalyticsMetadataKey.AssetId]: fromAsset,
        })
        const assetId = await requestBottomSheet<string>({
            contents: (
                <SwapAssetSelectionContent
                    variant='from'
                    excludeAssetId={toAsset}
                />
            ),
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        if (!assetId) return
        setFromAsset(assetId)
        setReceiveAmount(null)
        setSelectedProviderName(null)
        resetQuotes()
    }, [requestBottomSheet, toAsset, setFromAsset, fromAsset, resetQuotes])

    const handleOpenReceiveAssetSelection = useCallback(async () => {
        trackEvent(SwapEvent.SelectToToken, {
            [AnalyticsMetadataKey.AssetId]: toAsset,
        })
        const assetId = await requestBottomSheet<string>({
            contents: (
                <SwapAssetSelectionContent
                    variant='to'
                    fromAssetId={fromAsset}
                    excludeAssetId={fromAsset}
                />
            ),
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        if (!assetId) return
        setToAsset(assetId)
        setReceiveAmount(null)
        setSelectedProviderName(null)
        resetQuotes()
    }, [requestBottomSheet, fromAsset, setToAsset, toAsset, resetQuotes])

    const handleOpenProvider = useCallback(async () => {
        trackEvent(SwapEvent.SelectProviderOpen, {
            [AnalyticsMetadataKey.RouterName]:
                selectedProviderName ?? undefined,
        })
        const result = await requestBottomSheet<SwapProviderResult>({
            contents: (
                <SwapProviderContent
                    quotes={allQuotes}
                    selectedProviderName={selectedProviderName}
                />
            ),
            // PWSheetLayout owns the scroll view, so it needs a bounded size
            // (not 'auto'): when the sheet hugs its content the scroll view has
            // no height to scroll within and a long provider list would clip.
            // autoCreateContainer:false so the layout (not the sheet) owns the
            // scroll container.
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        // undefined means the sheet was dismissed; null means Auto was applied.
        if (result === undefined) return
        setSelectedProviderName(result)
    }, [requestBottomSheet, allQuotes, selectedProviderName])

    const handleOpenConfirm = useCallback(async () => {
        if (!selectedQuote) return

        trackEvent(SwapEvent.ConfirmSwapButton)
        const result = await requestBottomSheet<SwapConfirmationResult>({
            contents: <SwapConfirmationContent quote={selectedQuote} />,
            options: {
                size: 'auto',
                enablePanDownToClose: false,
                enableCloseOnBackdropPress: false,
                autoCreateContainer: false,
            },
        })
        if (!result || result.kind === 'cancelled') return
        if (result.kind === 'stale-quote') {
            // The quote outlived its TTL (e.g. the app sat offline between
            // quote and confirm). Nothing executed — fetch a fresh rate and
            // ask the user to review and confirm again.
            refreshQuotes()
            infoToast(
                t('swap.quote.refreshed_title'),
                t('swap.quote.refreshed_body'),
            )
            return
        }
        if (result.kind === 'error') {
            errorToast(t('swap.execution.error_title'), result.message)
            return
        }

        if (result.kind === 'pending-cosign') {
            // Shared-account swap: proposed, awaiting co-signer approval. Reset
            // the form and inform the user; balances change only once it
            // submits (handled later by the cosign resolver).
            successToast(
                t('swap.execution.pending_cosign_title'),
                t('swap.execution.pending_cosign_body'),
            )
            setPayAmount(null)
            setReceiveAmount(null)
            setSelectedProviderName(null)
            resetQuotes()
            return
        }

        invalidateAccountBalances()

        const fromUnit = selectedQuote.assetIn.unitName ?? ''
        const toUnit = selectedQuote.assetOut.unitName ?? ''

        successToast(
            t('swap.execution.success_title'),
            t('swap.execution.success_body', {
                fromAsset: fromUnit,
                toAsset: toUnit,
            }),
        )
        setPayAmount(null)
        setReceiveAmount(null)
        setSelectedProviderName(null)
        resetQuotes()
    }, [
        selectedQuote,
        requestBottomSheet,
        invalidateAccountBalances,
        successToast,
        errorToast,
        infoToast,
        refreshQuotes,
        t,
        resetQuotes,
    ])

    const handleOpenConfig = useCallback(async () => {
        const result = await requestBottomSheet<SwapConfigurationResult>({
            contents: <SwapConfigurationContent />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        if (!result) return

        setSlippage(result.slippageTolerance)

        setIsLocalCurrencyInput(result.useLocalCurrency)

        if (result.balancePercentage !== null) {
            void applyPercentageAmount(result.balancePercentage)
        }
    }, [
        requestBottomSheet,
        setSlippage,
        setIsLocalCurrencyInput,
        applyPercentageAmount,
    ])

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
        providerSelectionMode,
        canSwap,
        isLocalCurrencyInput,
        handlePayAmountChange,
        handleSwapDirection,
        handleMaxPress,
        handleOpenPayAssetSelection: () => void handleOpenPayAssetSelection(),
        handleOpenReceiveAssetSelection: () =>
            void handleOpenReceiveAssetSelection(),
        handleOpenConfig: () => void handleOpenConfig(),
        handleOpenProvider: () => void handleOpenProvider(),
        handleOpenConfirm: () => void handleOpenConfirm(),
    }
}
