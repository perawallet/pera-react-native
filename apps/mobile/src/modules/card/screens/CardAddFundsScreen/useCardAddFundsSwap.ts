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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type Decimal } from 'decimal.js'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    baseUnitsToDisplayUnits,
    displayUnitsToBaseUnits,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import {
    useCreateQuotesMutation,
    type SwapQuote,
} from '@perawallet/wallet-core-swaps'
import { useDeviceID } from '@perawallet/wallet-core-device'
import {
    isDecimalEqual,
    uint64IdToNumber,
    useDebouncedValue,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useSwapExecution } from '@modules/swap/hooks'
import {
    formatSwapRate,
    pickBestByAmountOut,
} from '@modules/swap/hooks/swapQuoteHelpers'

// Mirrors the swap form's quote debounce so typing doesn't fire a request per key.
const QUOTE_DEBOUNCE_MS = 500

const SWAPPING_STATUSES = new Set([
    'preparing',
    'signing',
    'submitting',
    'updating-status',
])

type CardAddFundsSwapOutcome =
    | { kind: 'success' }
    | { kind: 'cancelled' }
    | { kind: 'error'; message: string }

type UseCardAddFundsSwapParams = {
    account: Nullable<WalletAccount>
    sourceAssetId: string
    sourceDecimals: number
    usdcAssetId: string
    usdcDecimals: number
    /** Amount in the source asset's display units (0 when empty). */
    amount: Decimal
    /** Only fetch/execute when a non-USDC source is selected. */
    enabled: boolean
}

type UseCardAddFundsSwapResult = {
    quote: Nullable<SwapQuote>
    /** e.g. "1 ALGO ≈ 0.30 USDC". */
    rate: Nullable<string>
    /** Quoted USDC output in display units. */
    usdcOut: Nullable<Decimal>
    isQuoteFetching: boolean
    isSwapping: boolean
    executeSwap: () => Promise<CardAddFundsSwapOutcome>
}

/**
 * Quote + execution glue for the Add Funds internal swap (any asset → USDC).
 * Reuses the swap module's quote pipeline (`useCreateQuotesMutation` +
 * `pickBestByAmountOut`) and `useSwapExecution`, fixing the output asset to
 * USDC and signing with the passed account.
 */
export const useCardAddFundsSwap = ({
    account,
    sourceAssetId,
    sourceDecimals,
    usdcAssetId,
    usdcDecimals,
    amount,
    enabled,
}: UseCardAddFundsSwapParams): UseCardAddFundsSwapResult => {
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)

    const { mutateAsync: createQuotes, isPending: isQuoteLoading } =
        useCreateQuotesMutation()
    const createQuotesRef = useRef(createQuotes)
    createQuotesRef.current = createQuotes

    const [allQuotes, setAllQuotes] = useState<SwapQuote[]>([])
    const [quotedAmount, setQuotedAmount] = useState<Nullable<Decimal>>(null)

    const debouncedAmount = useDebouncedValue(
        amount,
        QUOTE_DEBOUNCE_MS,
        isDecimalEqual,
    )

    useEffect(() => {
        if (!enabled || !account || debouncedAmount.lte(0)) {
            setAllQuotes([])
            setQuotedAmount(null)
            return
        }

        const amountInBaseUnits = displayUnitsToBaseUnits(
            debouncedAmount,
            sourceDecimals,
        )
        let cancelled = false

        const fetchQuotes = async () => {
            try {
                const result = await createQuotesRef.current({
                    swapper_address: account.address,
                    swap_type: 'fixed-input',
                    asset_in_id: uint64IdToNumber(sourceAssetId),
                    asset_out_id: uint64IdToNumber(usdcAssetId),
                    amount: amountInBaseUnits.toFixed(0),
                    device: deviceId ?? null,
                })
                if (cancelled) return
                setAllQuotes(result)
                setQuotedAmount(debouncedAmount)
            } catch {
                if (cancelled) return
                setAllQuotes([])
                setQuotedAmount(null)
            }
        }

        void fetchQuotes()
        return () => {
            cancelled = true
        }
    }, [
        enabled,
        account,
        debouncedAmount,
        sourceAssetId,
        usdcAssetId,
        sourceDecimals,
        deviceId,
    ])

    const quote = useMemo(() => pickBestByAmountOut(allQuotes), [allQuotes])
    const rate = useMemo(() => (quote ? formatSwapRate(quote) : null), [quote])
    const usdcOut = useMemo(
        () =>
            quote?.amountOut
                ? baseUnitsToDisplayUnits(quote.amountOut, usdcDecimals)
                : null,
        [quote, usdcDecimals],
    )

    const isDebouncing = !isDecimalEqual(amount, debouncedAmount)
    const hasUnresolvedQuote =
        amount.gt(0) && !isDecimalEqual(amount, quotedAmount)
    const isQuoteFetching =
        enabled && (isQuoteLoading || isDebouncing || hasUnresolvedQuote)

    const { execute, status } = useSwapExecution()
    const isSwapping = SWAPPING_STATUSES.has(status)

    const executeSwap =
        useCallback(async (): Promise<CardAddFundsSwapOutcome> => {
            if (!quote?.quoteIdStr) {
                return { kind: 'error', message: '' }
            }
            const outcome = await execute(quote.quoteIdStr)
            if (outcome.kind === 'success') return { kind: 'success' }
            if (outcome.kind === 'cancelled') return { kind: 'cancelled' }
            return { kind: 'error', message: outcome.message }
        }, [quote, execute])

    return { quote, rate, usdcOut, isQuoteFetching, isSwapping, executeSwap }
}
