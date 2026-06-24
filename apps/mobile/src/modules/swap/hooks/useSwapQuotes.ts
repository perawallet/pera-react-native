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

import { useCallback, useEffect, useRef, useState } from 'react'
import { Keyboard } from 'react-native'
import { type Decimal } from 'decimal.js'
import {
    displayUnitsToBaseUnits,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import {
    percentToApiSlippage,
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

// Debounce so typing an amount doesn't fire a quote request per keystroke.
const QUOTE_DEBOUNCE_MS = 500

type UseSwapQuotesParams = {
    /** When false, no quote is fetched (e.g. USDC selected in Add Funds). */
    enabled?: boolean
    /** Account that signs the swap; null until one is resolved. */
    swapperAddress: Nullable<string>
    fromAssetId: string
    toAssetId: string
    /** Pay amount in display units (live value — the hook debounces it). */
    payAmount: Nullable<Decimal>
    payDecimals: Nullable<number>
    /** Slippage tolerance as a percent string (e.g. "1"); omit for none. */
    slippage?: Nullable<string>
}

type UseSwapQuotesResult = {
    allQuotes: SwapQuote[]
    quotedAmount: Nullable<Decimal>
    isQuoteFetching: boolean
    isQuoteError: boolean
    /** Clears the quotes and resets the underlying mutation. */
    reset: () => void
}

/**
 * Fetches swap quotes for (fromAsset → toAsset, fixed-input) with a debounce,
 * tracking the fetch state. Shared by the swap form and the card Add Funds
 * flow — it owns only the raw quote fetch; callers layer provider selection /
 * receive-amount derivation on top of `allQuotes`.
 */
export const useSwapQuotes = ({
    enabled = true,
    swapperAddress,
    fromAssetId,
    toAssetId,
    payAmount,
    payDecimals,
    slippage,
}: UseSwapQuotesParams): UseSwapQuotesResult => {
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)

    const {
        mutateAsync: createQuotes,
        isPending: isQuoteLoading,
        isError: isQuoteError,
        reset: resetQuoteMutation,
    } = useCreateQuotesMutation()
    const createQuotesRef = useRef(createQuotes)
    createQuotesRef.current = createQuotes

    const [allQuotes, setAllQuotes] = useState<SwapQuote[]>([])
    const [quotedAmount, setQuotedAmount] = useState<Nullable<Decimal>>(null)

    const debouncedPayAmount = useDebouncedValue(
        payAmount,
        QUOTE_DEBOUNCE_MS,
        isDecimalEqual,
    )

    const reset = useCallback(() => {
        setAllQuotes([])
        setQuotedAmount(null)
        resetQuoteMutation()
    }, [resetQuoteMutation])

    useEffect(() => {
        if (
            !enabled ||
            !swapperAddress ||
            !debouncedPayAmount ||
            debouncedPayAmount.isZero() ||
            debouncedPayAmount.isNeg() ||
            payDecimals == null
        ) {
            setAllQuotes([])
            setQuotedAmount(null)
            return
        }

        const amountInBaseUnits = displayUnitsToBaseUnits(
            debouncedPayAmount,
            payDecimals,
        )

        let cancelled = false

        const fetchQuotes = async () => {
            try {
                const result = await createQuotesRef.current({
                    swapper_address: swapperAddress,
                    swap_type: 'fixed-input',
                    // uint64IdToNumber (not Number()): throws on ids above
                    // 2^53 - 1 instead of silently quoting a different asset.
                    asset_in_id: uint64IdToNumber(fromAssetId),
                    asset_out_id: uint64IdToNumber(toAssetId),
                    amount: amountInBaseUnits.toFixed(0),
                    slippage:
                        slippage != null
                            ? percentToApiSlippage(slippage)
                            : undefined,
                    device: deviceId ?? null,
                })

                if (cancelled) return

                setAllQuotes(result)
                setQuotedAmount(debouncedPayAmount)
                Keyboard.dismiss()
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
        swapperAddress,
        debouncedPayAmount,
        fromAssetId,
        toAssetId,
        payDecimals,
        slippage,
        deviceId,
    ])

    const isDebouncing = !isDecimalEqual(payAmount, debouncedPayAmount)
    const hasUnresolvedQuote =
        payAmount !== null &&
        !payAmount.isZero() &&
        !payAmount.isNeg() &&
        !isDecimalEqual(payAmount, quotedAmount) &&
        !isQuoteError
    const isQuoteFetching =
        enabled && (isQuoteLoading || isDebouncing || hasUnresolvedQuote)

    return { allQuotes, quotedAmount, isQuoteFetching, isQuoteError, reset }
}
