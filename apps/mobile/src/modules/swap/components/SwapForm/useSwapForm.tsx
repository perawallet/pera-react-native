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
    addressOn,
    ownAddressOf,
    useAccountBalancesInvalidator,
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { nativeAssetFor, useAssetsQuery } from '@perawallet/wallet-core-assets'
import { trackEvent, SwapEvent, AnalyticsMetadataKey } from '@analytics'
import { useSpendableBalanceQuery } from '@perawallet/wallet-core-transactions'
import {
    peraFeeInSourceAsset,
    pickBestByAmountOut,
    swapAdapterFor,
    useSwaps,
    type SwapQuote,
    type SwapConfigurationResult,
} from '@perawallet/wallet-core-swaps'
import {
    isDecimalEqual,
    type Nullable,
    baseUnitsToDisplayUnits,
    displayUnitsToBaseUnits,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useToast } from '@hooks/useToast'
import { useIsCrossChainSwapEnabled } from '@hooks/useIsCrossChainSwapEnabled'
import { useLanguage } from '@hooks/useLanguage'
import {
    clearTabResumeIntent,
    completeTabResume,
    registerTabResumeIntent,
} from '@utils/tabResumeIntent'
import { useSwapQuotes } from '../../hooks/useSwapQuotes'
import { useSwapReceiveTarget } from '../../hooks/useSwapReceiveTarget'
import {
    SwapAssetSelectionContent,
    type SwapAssetSelection,
} from '../SwapAssetSelectionContent'
import { SwapReceivingAccountContent } from '../SwapReceivingAccountContent'
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
    /** Where the receive asset lives: the swap scope, or another chain's. */
    receiveScope: ChainScope
    receivingAccount: Nullable<WalletAccount>
    isDirectionDisabled: boolean
    isChainShown: boolean
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
    handlePayAmountFocus: () => void
    handleSwapDirection: () => void
    handleMaxPress: () => void
    handleOpenPayAssetSelection: () => void
    handleOpenReceiveAssetSelection: () => void
    handleOpenReceivingAccount: () => void
    handleOpenConfig: () => void
    handleOpenProvider: () => void
    handleOpenConfirm: () => void
}

/**
 * A swap a browser tab resumes from the extension popup, where it was already
 * on its confirmation: the amount (display units) to restore once the pay
 * asset settles, after which the form reopens the confirmation.
 */
export type SwapFormInitialPayAmount = {
    assetId: string
    amount: Decimal
}

export const useSwapForm = (
    scope: ChainScope,
    initialPayAmount?: SwapFormInitialPayAmount,
): UseSwapFormResult => {
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
    } = useSwaps(scope)
    const [payAmount, setPayAmount] = useState<Nullable<Decimal>>(null)
    const [receiveAmount, setReceiveAmount] = useState<Nullable<Decimal>>(null)
    const [selectedProviderName, setSelectedProviderName] =
        useState<Nullable<string>>(null)
    const { request: requestBottomSheet } = useBottomSheet()
    const selectedAccount = useSelectedAccount()
    const selectedAddress = selectedAccount
        ? addressOn(selectedAccount, scope)
        : undefined
    const nativeAssetId = nativeAssetFor(scope.chainId).assetId
    // Only a MAX or percentage fill follows the balance and the quote's fee; a
    // typed amount stays as typed and fails at the balance checks instead.
    const isPercentageFillRef = useRef(false)

    const { invalidate: invalidateAccountBalances } =
        useAccountBalancesInvalidator()
    const { successToast, errorToast, infoToast } = useToast()
    const { t } = useLanguage()

    const { data: payAssets } = useAssetsQuery(scope, [fromAsset])
    const payAsset = payAssets?.get(fromAsset)

    const {
        data: payAssetBalance,
        isFetched: isPayBalanceFetched,
        isError: isPayBalanceError,
    } = useAccountAssetBalanceQuery(
        selectedAccount ?? undefined,
        fromAsset,
        scope,
    )
    const isCrossChainEnabled = useIsCrossChainSwapEnabled()
    const {
        receiveScope,
        isCrossChain,
        receivingAccount,
        receivingAddress,
        receivingAccounts,
        selectReceivingAccount,
    } = useSwapReceiveTarget(scope)
    const { data: receiveAssetBalance } = useAccountAssetBalanceQuery(
        receivingAccount ?? undefined,
        toAsset,
        receiveScope,
    )

    // A percentage of what the account can spend, less the chain's fee reserve
    // and, for a first holding of the receive asset, the reserve it locks. An
    // unsettled receive balance reserves too: short of MAX beats failing at
    // confirm.
    const swapAdapter = swapAdapterFor(scope)
    const { data: spendable, isPending: isSpendablePending } =
        useSpendableBalanceQuery(
            selectedAccount
                ? {
                      account: selectedAccount,
                      asset: { chainId: scope.chainId, assetId: fromAsset },
                      scope,
                      fee: receiveAssetBalance
                          ? swapAdapter.maxAmountFeeReserve
                          : swapAdapter.maxAmountFeeReserve.add(
                                swapAdapter.holdingReserve(scope),
                            ),
                  }
                : undefined,
        )

    const {
        allQuotes,
        quotedAmount,
        isQuoteFetching,
        isQuoteError,
        reset: resetQuotes,
        refresh: refreshQuotes,
    } = useSwapQuotes({
        scope,
        swapperAddress: selectedAddress ?? null,
        fromAssetId: fromAsset,
        toAssetId: toAsset,
        toAssetScope: receiveScope,
        destinationAddress: receivingAddress,
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
        isPercentageFillRef.current = false
        setPayAmount(null)
        setReceiveAmount(null)
        setSelectedProviderName(null)
        resetQuotes()
    }, [resetQuotes])

    // The pair lives in the store while the balance behind it is per-account, so
    // carrying it across an account switch leaves the amounts describing the old
    // account and MAX quoting an asset the new one may not hold. Reset to the
    // default pair — the state a relaunch produced, which is what worked.
    const previousAddressRef = useRef(selectedAddress)
    useEffect(() => {
        const address = selectedAddress
        if (previousAddressRef.current === address) return
        previousAddressRef.current = address
        resetAmounts()
        resetAssetPair()
    }, [selectedAddress, resetAmounts, resetAssetPair])

    // The typed amount is denominated in the pay asset, so it cannot survive
    // the pay asset changing: quoting the old number against the new asset's
    // decimals produces a wrong quote. The pair also changes outside this hook
    // (pair-history and top-pair taps write straight into the store), hence an
    // effect on the store value rather than only the selection handler.
    // handleSwapDirection opts out by pre-setting the ref: its carry of the
    // amounts across the flip is deliberate.
    const previousFromAssetRef = useRef(fromAsset)
    useEffect(() => {
        if (previousFromAssetRef.current === fromAsset) return
        previousFromAssetRef.current = fromAsset
        resetAmounts()
    }, [fromAsset, resetAmounts])

    // Must follow the reset above: the route's pay asset lands in the store
    // after mount, and that change clears the amounts, so a resumed amount is
    // applied only once the store holds its asset.
    const pendingPayAmountRef = useRef(initialPayAmount)
    const shouldReopenConfirmRef = useRef(false)
    useEffect(() => {
        const pending = pendingPayAmountRef.current
        if (!pending || fromAsset !== pending.assetId) return
        pendingPayAmountRef.current = undefined
        shouldReopenConfirmRef.current = true
        setPayAmount(pending.amount)
    }, [fromAsset])

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
            // Editing takes over from a resume: no confirmation over a change.
            shouldReopenConfirmRef.current = false
            isPercentageFillRef.current = false
            setPayAmount(amount)
            if (!isDecimalEqual(amount, quotedAmount)) {
                resetQuotes()
                setReceiveAmount(null)
            }
        },
        [quotedAmount, resetQuotes],
    )

    const handlePayAmountFocus = useCallback(() => {
        trackEvent(SwapEvent.EnterNumbers, {
            [AnalyticsMetadataKey.ChainId]: scope.chainId,
        })
    }, [scope.chainId])

    const handleSwapDirection = useCallback(() => {
        if (isCrossChain) return
        previousFromAssetRef.current = toAsset
        isPercentageFillRef.current = false
        setFromAsset(toAsset)
        setToAsset(fromAsset)
        setPayAmount(receiveAmount)
        setReceiveAmount(payAmount)
        setSelectedProviderName(null)
        resetQuotes()
    }, [
        isCrossChain,
        fromAsset,
        toAsset,
        payAmount,
        receiveAmount,
        setFromAsset,
        setToAsset,
        resetQuotes,
    ])

    const showBalanceTooLow = useCallback(() => {
        infoToast(
            t('swap.form.balance_too_low_title'),
            t('swap.form.balance_too_low_body', {
                unit: payAsset?.unitName ?? fromAsset,
            }),
        )
    }, [infoToast, t, payAsset, fromAsset])

    const applyPercentageAmount = useCallback(
        (percentage: number) => {
            if (!selectedAddress) return
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
            // Pending includes the previous pay asset's max, kept as placeholder.
            if (!spendable || isSpendablePending) {
                errorToast(
                    t('swap.form.percentage_error_title'),
                    t('swap.form.percentage_error_body'),
                )
                return
            }
            const amount = spendable.max.mul(percentage).div(100).floor()
            if (amount.isZero()) {
                // Fee reserves can consume the whole balance; filling the
                // field with 0 would read as a dead button too.
                showBalanceTooLow()
                return
            }
            isPercentageFillRef.current = true
            setPayAmount(
                baseUnitsToDisplayUnits(amount, payAsset?.decimals ?? 0),
            )
        },
        [
            selectedAddress,
            fromAsset,
            payAsset,
            payAssetBalance,
            spendable,
            isSpendablePending,
            infoToast,
            errorToast,
            showBalanceTooLow,
            t,
        ],
    )

    // The Pera fee is known only once a quote answers, and it is charged on top
    // of the amount, so a fill with no room left for it shrinks and re-quotes.
    // Shrink only: the smaller amount's lower fee must not grow it back into
    // another request.
    useEffect(() => {
        if (!isPercentageFillRef.current) return
        if (!payAmount || !spendable || isSpendablePending) return
        const decimals = payAsset?.decimals ?? 0
        const amount = displayUnitsToBaseUnits(payAmount, decimals)
        const peraFee = selectedQuote?.request.sourceAmount.equals(amount)
            ? peraFeeInSourceAsset(selectedQuote)
            : new Decimal(0)
        const ceiling = spendable.max.sub(peraFee)
        if (amount.lessThanOrEqualTo(ceiling)) return
        if (ceiling.lessThanOrEqualTo(0)) {
            resetAmounts()
            showBalanceTooLow()
            return
        }
        setPayAmount(baseUnitsToDisplayUnits(ceiling.floor(), decimals))
        setReceiveAmount(null)
        resetQuotes()
    }, [
        payAmount,
        payAsset?.decimals,
        selectedQuote,
        spendable,
        isSpendablePending,
        resetAmounts,
        resetQuotes,
        showBalanceTooLow,
    ])

    const handleMaxPress = useCallback(() => {
        applyPercentageAmount(100)
    }, [applyPercentageAmount])

    const handleOpenPayAssetSelection = useCallback(async () => {
        trackEvent(SwapEvent.SelectFromToken, {
            [AnalyticsMetadataKey.ChainId]: scope.chainId,
            [AnalyticsMetadataKey.AssetId]: fromAsset,
        })
        const selection = await requestBottomSheet<SwapAssetSelection>({
            contents: (
                <SwapAssetSelectionContent
                    scope={scope}
                    variant='from'
                    excludeAssetId={isCrossChain ? undefined : toAsset}
                />
            ),
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        // Re-picking the current asset must be a full no-op: clearing the
        // quotes without changing any quote input would strand the fetch
        // state as loading with nothing in flight.
        if (!selection || selection.assetId === fromAsset) return
        setFromAsset(selection.assetId)
        // The effect above also resets, but only after a paint; reset here
        // too so no frame shows the old amount against the new asset.
        resetAmounts()
    }, [
        requestBottomSheet,
        scope,
        toAsset,
        isCrossChain,
        setFromAsset,
        fromAsset,
        resetAmounts,
    ])

    const handleOpenReceiveAssetSelection = useCallback(async () => {
        trackEvent(SwapEvent.SelectToToken, {
            [AnalyticsMetadataKey.ChainId]: scope.chainId,
            [AnalyticsMetadataKey.AssetId]: toAsset,
        })
        const selection = await requestBottomSheet<SwapAssetSelection>({
            contents: (
                <SwapAssetSelectionContent
                    scope={scope}
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
        if (!selection) return
        setToAsset(selection.assetId, selection.scope)
        setReceiveAmount(null)
        setSelectedProviderName(null)
        resetQuotes()
    }, [requestBottomSheet, scope, fromAsset, setToAsset, toAsset, resetQuotes])

    const handleOpenReceivingAccount = useCallback(async () => {
        await requestBottomSheet<string>({
            contents: (
                <SwapReceivingAccountContent
                    accounts={receivingAccounts}
                    chainId={receiveScope.chainId}
                    selectedAddress={
                        receivingAccount
                            ? (ownAddressOf(receivingAccount) ?? null)
                            : null
                    }
                    onSelect={selectReceivingAccount}
                />
            ),
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [
        requestBottomSheet,
        receivingAccounts,
        receiveScope.chainId,
        receivingAccount,
        selectReceivingAccount,
    ])

    const handleOpenProvider = useCallback(async () => {
        trackEvent(SwapEvent.SelectProviderOpen, {
            [AnalyticsMetadataKey.ChainId]: scope.chainId,
            [AnalyticsMetadataKey.RouterName]:
                selectedProviderName ?? undefined,
        })
        const result = await requestBottomSheet<SwapProviderResult>({
            contents: (
                <SwapProviderContent
                    scope={scope}
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
    }, [requestBottomSheet, scope, allQuotes, selectedProviderName])

    const handleOpenConfirm = useCallback(async () => {
        if (!selectedQuote) return

        trackEvent(SwapEvent.ConfirmSwapButton, {
            [AnalyticsMetadataKey.ChainId]: scope.chainId,
        })
        // Signing runs while this sheet is open; a Bluetooth Ledger in the
        // extension popup can't sign, and this lets its tab reopen the swap.
        if (selectedAddress && payAmount) {
            registerTabResumeIntent({
                flow: 'swap',
                chainId: scope.chainId,
                accountAddress: selectedAddress,
                assetInId: fromAsset ?? nativeAssetId,
                assetOutId: toAsset,
                payAmount: payAmount.toFixed(),
            })
        }
        let result: Optional<SwapConfirmationResult>
        try {
            result = await requestBottomSheet<SwapConfirmationResult>({
                contents: (
                    <SwapConfirmationContent
                        scope={scope}
                        quote={selectedQuote}
                    />
                ),
                options: {
                    size: 'auto',
                    enablePanDownToClose: false,
                    enableCloseOnBackdropPress: false,
                    autoCreateContainer: false,
                },
            })
        } finally {
            clearTabResumeIntent()
        }
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
            errorToast(
                result.title ?? t('swap.execution.error_title'),
                result.message,
            )
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

        // A cross-chain payout lands minutes later; the tracked list follows it.
        const isTracked = selectedQuote.routeKind === 'cross-chain'
        const successTitle = isTracked
            ? t('swap.tracking.started')
            : t('swap.execution.success_title')
        const successBody = isTracked
            ? t('swap.tracking.in_progress')
            : t('swap.execution.success_body', {
                  fromAsset: fromUnit,
                  toAsset: toUnit,
              })
        successToast(successTitle, successBody)
        completeTabResume({ title: successTitle, body: successBody })
        resetAmounts()
    }, [
        scope,
        selectedQuote,
        requestBottomSheet,
        invalidateAccountBalances,
        successToast,
        errorToast,
        infoToast,
        refreshQuotes,
        t,
        resetAmounts,
        selectedAddress,
        payAmount,
        fromAsset,
        nativeAssetId,
        toAsset,
    ])

    // The resumed swap's confirmation, on the tab's own fresh quote: the
    // popup's quote may have expired. Waits for the balance too, since
    // `canSwap` reads an unsettled balance as sufficient.
    useEffect(() => {
        if (!shouldReopenConfirmRef.current) return
        if (!canSwap || !isPayBalanceFetched) return
        shouldReopenConfirmRef.current = false
        void handleOpenConfirm()
    }, [canSwap, isPayBalanceFetched, handleOpenConfirm])

    const handleOpenConfig = useCallback(async () => {
        const result = await requestBottomSheet<SwapConfigurationResult>({
            contents: <SwapConfigurationContent scope={scope} />,
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
            applyPercentageAmount(result.balancePercentage)
        }
    }, [
        requestBottomSheet,
        scope,
        setSlippage,
        setIsLocalCurrencyInput,
        applyPercentageAmount,
    ])

    return {
        payAssetId: fromAsset,
        receiveAssetId: toAsset,
        receiveScope,
        receivingAccount,
        isDirectionDisabled: isCrossChain,
        isChainShown: isCrossChainEnabled && isCrossChain,
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
        handlePayAmountFocus,
        handleSwapDirection,
        handleMaxPress,
        handleOpenPayAssetSelection: () => void handleOpenPayAssetSelection(),
        handleOpenReceiveAssetSelection: () =>
            void handleOpenReceiveAssetSelection(),
        handleOpenReceivingAccount: () => void handleOpenReceivingAccount(),
        handleOpenConfig: () => void handleOpenConfig(),
        handleOpenProvider: () => void handleOpenProvider(),
        handleOpenConfirm: () => void handleOpenConfirm(),
    }
}
