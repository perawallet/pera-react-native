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

import { useCallback, useMemo, useRef, useState } from 'react'
import { Decimal } from 'decimal.js'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    baseUnitsToDisplayUnits,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { useAccountBalancesInvalidator } from '@perawallet/wallet-core-accounts'
import {
    formatAssetAmount,
    getKnownAssetId,
    useAssetsQuery,
    type DisplayableAsset,
} from '@perawallet/wallet-core-assets'
import { apiSlippageToPercent } from '@perawallet/wallet-core-swaps'
import {
    logger,
    type Maybe,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { trackEvent, CardEvent } from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import {
    useCardErrorToast,
    useCardFundingAccount,
    useCardManualDeposit,
    useCardUsdcCredit,
} from '../../hooks'
import type { CardStepStatus } from '../../components/CardStepRow'
import { USDC_DISPLAY_PRECISION } from '../../utils/usdc'
import type { PeraCardFlowParamList } from '../../routes/types'
import { useCardAddFundsSwap } from '../CardAddFundsScreen/useCardAddFundsSwap'

const EMPTY_VALUE = '—'

/**
 * `swapping` covers the swap itself, `depositing` the wait for the USDC to
 * land plus the transfer onto the card. `deposit-failed` means the swap went
 * through and the USDC sits in the linked account, so only the deposit is
 * offered again.
 */
export type CardConfirmSwapStep =
    | 'idle'
    | 'swapping'
    | 'depositing'
    | 'deposit-failed'

export type CardConfirmSwapStepId = 'swap' | 'deposit'
export type CardConfirmSwapStepRowModel = {
    id: CardConfirmSwapStepId
    stepNumber: number
    status: CardStepStatus
    /** The step's work is in flight; the row shows a spinner. */
    isBusy: boolean
}

const STEP_ROWS: Record<CardConfirmSwapStep, CardConfirmSwapStepRowModel[]> = {
    idle: [
        { id: 'swap', stepNumber: 1, status: 'pending', isBusy: false },
        { id: 'deposit', stepNumber: 2, status: 'pending', isBusy: false },
    ],
    swapping: [
        { id: 'swap', stepNumber: 1, status: 'active', isBusy: true },
        { id: 'deposit', stepNumber: 2, status: 'pending', isBusy: false },
    ],
    depositing: [
        { id: 'swap', stepNumber: 1, status: 'done', isBusy: false },
        { id: 'deposit', stepNumber: 2, status: 'active', isBusy: true },
    ],
    'deposit-failed': [
        { id: 'swap', stepNumber: 1, status: 'done', isBusy: false },
        { id: 'deposit', stepNumber: 2, status: 'failed', isBusy: false },
    ],
}

type UseCardConfirmSwapScreenResult = {
    step: CardConfirmSwapStep
    steps: CardConfirmSwapStepRowModel[]
    handleRetryDeposit: () => void
    sourceAsset: Maybe<DisplayableAsset>
    usdcAsset: Maybe<DisplayableAsset>
    payDisplay: string
    receiveDisplay: string
    priceDisplay: string
    slippageDisplay: string
    priceImpactDisplay: string
    minimumReceivedDisplay: string
    exchangeFeeDisplay: string
    peraFeeDisplay: string
    /** True while the (re-fetched) quote is still loading. */
    isQuoteLoading: boolean
    isConfirmDisabled: boolean
    isConfirming: boolean
    handleConfirm: () => void
}

export const useCardConfirmSwapScreen = (): UseCardConfirmSwapScreenResult => {
    const { params } =
        useRoute<RouteProp<PeraCardFlowParamList, 'CardConfirmSwap'>>()
    const navigation =
        useNavigation<NativeStackNavigationProp<PeraCardFlowParamList>>()
    const { network } = useNetwork()
    const { t } = useLanguage()
    const { successToast, errorToast, infoToast } = useToast()
    const { invalidate: invalidateBalances } = useAccountBalancesInvalidator()
    const { deposit } = useCardManualDeposit()
    const { readUsdcBalance, waitForUsdcCredit } = useCardUsdcCredit()
    const showDepositError = useCardErrorToast({
        titleKey: 'peraCard.add_funds.swap_deposit_failed_title',
        bodyKey: 'peraCard.add_funds.swap_deposit_failed_body',
        shouldUseBackendMessage: false,
    })
    const [step, setStep] = useState<CardConfirmSwapStep>('idle')
    // The USDC balance before the swap and the amount it credited; kept in
    // refs so a retry after a failed deposit reuses them.
    const balanceBeforeRef = useRef<Nullable<bigint>>(null)
    const creditedRef = useRef<Nullable<bigint>>(null)

    // Same account the Add Funds screen swaps from: the one linked to the card.
    const account = useCardFundingAccount()

    const usdcAssetId = useMemo(
        () => getKnownAssetId('USDC', network),
        [network],
    )
    const assetIds = useMemo(
        () => [usdcAssetId, params.sourceAssetId].filter(id => id !== null),
        [usdcAssetId, params.sourceAssetId],
    )
    const { data: assets } = useAssetsQuery(assetIds)
    const usdcAsset = useMemo(
        () => (usdcAssetId === null ? undefined : assets.get(usdcAssetId)),
        [assets, usdcAssetId],
    )
    const sourceAsset = useMemo(
        () => assets.get(params.sourceAssetId),
        [assets, params.sourceAssetId],
    )
    const sourceDecimals = sourceAsset?.decimals ?? 6
    const usdcDecimals = usdcAsset?.decimals ?? 6
    const sourceUnit = sourceAsset?.unitName ?? ''
    const usdcUnit = usdcAsset?.unitName ?? 'USDC'

    const amountDecimal = useMemo(
        () => new Decimal(params.amount),
        [params.amount],
    )

    // Re-quote at confirm time so we sign the freshest rate (no need to pass the
    // non-serializable quote through navigation).
    const { quote, isQuoteFetching, isSwapping, executeSwap, refreshQuote } =
        useCardAddFundsSwap({
            account,
            sourceAssetId: params.sourceAssetId,
            sourceDecimals,
            usdcAssetId: usdcAssetId ?? '',
            usdcDecimals,
            amount: amountDecimal,
            // No known USDC id on this network — nothing to swap into. In
            // practice this screen is unreachable in that case (Add Funds
            // never offers the swap), but the type still admits it.
            enabled: usdcAssetId !== null,
        })

    const payDisplay = useMemo(() => {
        if (!quote?.amountIn) return EMPTY_VALUE
        return formatAssetAmount(quote.amountIn, {
            decimals: sourceDecimals,
            unitName: sourceUnit,
        })
    }, [quote?.amountIn, sourceDecimals, sourceUnit])

    // Same rounding as the Add Funds screen; the exact figure sits in the
    // swap details below.
    const receiveDisplay = useMemo(() => {
        if (!quote?.amountOut) return EMPTY_VALUE
        const usdcOut = baseUnitsToDisplayUnits(quote.amountOut, usdcDecimals)
        return `${usdcOut.toFixed(USDC_DISPLAY_PRECISION)} ${usdcUnit}`
    }, [quote?.amountOut, usdcDecimals, usdcUnit])

    const priceDisplay = useMemo(() => {
        if (!quote?.price) return EMPTY_VALUE
        return `${quote.price.toDecimalPlaces(usdcDecimals).toString()} ${usdcUnit} per ${sourceUnit}`
    }, [quote?.price, usdcDecimals, usdcUnit, sourceUnit])

    const slippageDisplay = useMemo(
        () =>
            quote?.slippage
                ? `${apiSlippageToPercent(quote.slippage)}%`
                : EMPTY_VALUE,
        [quote?.slippage],
    )

    const priceImpactDisplay = useMemo(
        () =>
            quote?.priceImpact
                ? `${quote.priceImpact.toDecimalPlaces(2).toString()}%`
                : EMPTY_VALUE,
        [quote?.priceImpact],
    )

    const minimumReceivedDisplay = useMemo(() => {
        if (!quote?.amountOutWithSlippage) return EMPTY_VALUE
        return formatAssetAmount(quote.amountOutWithSlippage, {
            decimals: usdcDecimals,
            unitName: usdcUnit,
        })
    }, [quote?.amountOutWithSlippage, usdcDecimals, usdcUnit])

    const exchangeFeeDisplay = useMemo(() => {
        if (quote?.transactionFees == null) return EMPTY_VALUE
        return formatAssetAmount(quote.transactionFees, {
            decimals: sourceDecimals,
            unitName: sourceUnit,
        })
    }, [quote?.transactionFees, sourceDecimals, sourceUnit])

    const peraFeeDisplay = useMemo(
        () =>
            formatAssetAmount(quote?.peraFeeAmount ?? new Decimal(0), {
                decimals: quote?.peraFeeAsset?.decimals ?? sourceDecimals,
                unitName: quote?.peraFeeAsset?.unitName ?? sourceUnit,
            }),
        [quote?.peraFeeAmount, quote?.peraFeeAsset, sourceDecimals, sourceUnit],
    )

    // Moves the swapped USDC onto the card. The swap pays the linked account,
    // so wait for the credit to show on chain and deposit exactly that.
    const depositCredit = useCallback(async () => {
        if (!account) return
        setStep('depositing')
        try {
            const credited =
                creditedRef.current ??
                (await waitForUsdcCredit({
                    address: account.address,
                    before: balanceBeforeRef.current ?? 0n,
                    minimum: quote?.amountOutWithSlippage
                        ? BigInt(quote.amountOutWithSlippage.toFixed(0))
                        : 0n,
                }))
            creditedRef.current = credited
            const amount = baseUnitsToDisplayUnits(credited, usdcDecimals)
            await deposit({ account, amount })
            successToast(
                t('peraCard.add_funds.deposit_success_title'),
                t('peraCard.add_funds.swap_deposit_success_body', {
                    amount: amount.toFixed(USDC_DISPLAY_PRECISION),
                }),
            )
            invalidateBalances()
            setStep('idle')
            // Add Funds and this screen sit on top of the card screen; the
            // funds are on the card now, so land the user back there.
            navigation.pop(2)
        } catch (error) {
            // The swap already went through: leave the user on a screen that
            // says so and offers the deposit alone. A declined signing review
            // is a normal action and gets no toast.
            setStep('deposit-failed')
            if (error instanceof UserRejectedSigningError) return
            logger.error('Card deposit after swap failed', { error })
            await showDepositError(error)
        }
    }, [
        account,
        quote,
        usdcDecimals,
        waitForUsdcCredit,
        deposit,
        successToast,
        t,
        invalidateBalances,
        navigation,
        showDepositError,
    ])

    const handleRetryDeposit = useCallback(() => {
        void depositCredit()
    }, [depositCredit])

    const handleConfirm = useCallback(() => {
        // Design allows `card_getUSDC_confirm` for this screen too, but the
        // Get-USDC flow isn't built — this screen is only reachable from Add Funds.
        trackEvent(CardEvent.AddFundsConfirm)
        const run = async () => {
            if (account) {
                balanceBeforeRef.current = await readUsdcBalance(
                    account.address,
                )
            }
            creditedRef.current = null
            setStep('swapping')
            const outcome = await executeSwap()
            if (outcome.kind === 'success') {
                await depositCredit()
                return
            }
            setStep('idle')
            if (outcome.kind === 'pending-cosign') {
                // Shared-account swap proposed; co-signer must approve before it
                // submits. Inform the user and leave the screen.
                successToast(
                    t('swap.execution.pending_cosign_title'),
                    t('swap.execution.pending_cosign_body'),
                )
                navigation.goBack()
            } else if (outcome.kind === 'stale-quote') {
                // Quotes are fetched once and expire after a minute, so a
                // slow read of this screen lands here. Fetch a fresh rate
                // and have the user confirm it.
                refreshQuote()
                infoToast(
                    t('swap.quote.refreshed_title'),
                    t('swap.quote.refreshed_body'),
                )
            } else if (outcome.kind === 'verifying') {
                // Nothing was signed or broadcast — say so rather than leaving
                // the Confirm tap looking like a no-op.
                infoToast(
                    t('swap.execution.verifying_previous_title'),
                    t('swap.execution.verifying_previous_body'),
                )
            } else if (outcome.kind === 'error') {
                errorToast(
                    outcome.title ?? t('peraCard.add_funds.swap_error_title'),
                    outcome.message || t('peraCard.account.error_body'),
                )
            }
        }
        void run()
    }, [
        account,
        readUsdcBalance,
        executeSwap,
        refreshQuote,
        depositCredit,
        successToast,
        errorToast,
        infoToast,
        t,
        navigation,
    ])

    const isBusy = isSwapping || step === 'swapping' || step === 'depositing'

    return {
        sourceAsset,
        usdcAsset,
        payDisplay,
        receiveDisplay,
        priceDisplay,
        slippageDisplay,
        priceImpactDisplay,
        minimumReceivedDisplay,
        exchangeFeeDisplay,
        peraFeeDisplay,
        isQuoteLoading: isQuoteFetching && !quote,
        isConfirmDisabled: !quote || isQuoteFetching || isBusy,
        isConfirming: isBusy,
        step,
        steps: STEP_ROWS[step],
        handleConfirm,
        handleRetryDeposit,
    }
}
