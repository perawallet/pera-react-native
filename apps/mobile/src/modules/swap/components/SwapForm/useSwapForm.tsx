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
import { useFocusEffect } from '@react-navigation/native'
import { Decimal } from 'decimal.js'
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
    /** Pay amount exceeds what the account actually holds of the pay asset. */
    hasInsufficientBalance: boolean
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
        resetAssetPair,
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

    const {
        data: payAssetBalance,
        isFetched: isPayBalanceFetched,
        isError: isPayBalanceError,
    } = useAccountAssetBalanceQuery(selectedAccount ?? undefined, fromAsset)
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

    const resetAmounts = useCallback(() => {
        setPayAmount(null)
        setReceiveAmount(null)
        setSelectedProviderName(null)
        resetQuotes()
    }, [resetQuotes])

    // The pair lives in the store while the balance behind it is per-account, so
    // carrying it across an account switch leaves the amounts describing the old
    // account and MAX quoting an asset the new one may not hold. Reset to the
    // default pair — the state a relaunch produced, which is what worked.
    const previousAddressRef = useRef(selectedAccount?.address)
    useEffect(() => {
        const address = selectedAccount?.address
        if (previousAddressRef.current === address) return
        previousAddressRef.current = address
        resetAmounts()
        resetAssetPair()
    }, [selectedAccount?.address, resetAmounts, resetAssetPair])

    // Leaving the tab must clear the form: the screen stays mounted, so without
    // this the next visit opens on the previous session's amounts.
    useFocusEffect(
        useCallback(
            () => () => {
                resetAmounts()
                resetAssetPair()
            },
            [resetAmounts, resetAssetPair],
        ),
    )

    const hasInsufficientBalance = useMemo(() => {
        // Wait for the query to settle: the balance mapper reports zero while
        // asset metadata is still syncing, which would flash a false warning.
        if (payAmount === null || !isPayBalanceFetched) return false
        // `isFetched` is also true once a fetch has *failed*, where data is null
        // — treating that as a zero balance would blame the user's holding for a
        // failed load, and block the swap on it.
        if (isPayBalanceError) return false
        // Settled with no holding row means the account never opted in — a zero
        // balance, which is the case this warning exists for.
        const available = payAssetBalance?.amount ?? new Decimal(0)
        return payAmount.greaterThan(available)
    }, [
        payAmount,
        payAssetBalance?.amount,
        isPayBalanceFetched,
        isPayBalanceError,
    ])

    const canSwap = useMemo(
        () =>
            selectedQuote !== null &&
            payAmount !== null &&
            payAmount.greaterThan(0) &&
            !hasInsufficientBalance &&
            !isQuoteFetching,
        [selectedQuote, payAmount, hasInsufficientBalance, isQuoteFetching],
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
            // Every silent return here reads as a dead button, so say why.
            if (!payAssetBalance?.amount || payAssetBalance.amount.isZero()) {
                infoToast(
                    t('swap.form.no_balance_title'),
                    t('swap.form.no_balance_body', {
                        unit: payAsset?.unitName ?? fromAsset,
                    }),
                )
                return
            }
            try {
                const result = await calculateSwapAmountRef.current!({
                    address: selectedAccount.address,
                    asset_in_id: uint64IdToNumber(fromAsset),
                    asset_out_id: uint64IdToNumber(toAsset),
                    percentage: String(percentage / 100),
                })
                if (result.amount && !result.amount.isZero()) {
                    const displayAmount = baseUnitsToDisplayUnits(
                        result.amount,
                        payAsset?.decimals ?? 0,
                    )
                    setPayAmount(displayAmount)
                } else {
                    // The backend clamps the swappable amount at zero when
                    // fee reserves consume the balance; filling the field
                    // with 0 would read as a dead button too.
                    infoToast(
                        t('swap.form.balance_too_low_title'),
                        t('swap.form.balance_too_low_body', {
                            unit: payAsset?.unitName ?? fromAsset,
                        }),
                    )
                }
            } catch {
                // Already logged by the query client; the user needs to know the
                // tap did something.
                errorToast(
                    t('swap.form.percentage_error_title'),
                    t('swap.form.percentage_error_body'),
                )
            }
        },
        [
            selectedAccount,
            fromAsset,
            toAsset,
            payAsset,
            payAssetBalance,
            infoToast,
            errorToast,
            t,
        ],
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
            resetAmounts()
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
        resetAmounts()
    }, [
        selectedQuote,
        requestBottomSheet,
        invalidateAccountBalances,
        successToast,
        errorToast,
        infoToast,
        refreshQuotes,
        t,
        resetAmounts,
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
        hasInsufficientBalance,
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
