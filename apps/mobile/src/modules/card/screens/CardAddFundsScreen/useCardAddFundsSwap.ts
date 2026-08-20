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

import { useCallback, useMemo } from 'react'
import { type Decimal } from 'decimal.js'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import { baseUnitsToDisplayUnits } from '@perawallet/wallet-core-blockchain'
import { type SwapQuote } from '@perawallet/wallet-core-swaps'
import { type Nullable } from '@perawallet/wallet-core-shared'
import { useSwapExecution, useSwapQuotes } from '@modules/swap/hooks'
import {
    formatSwapRate,
    pickBestByAmountOut,
} from '@modules/swap/hooks/swapQuoteHelpers'

const SWAPPING_STATUSES = new Set([
    'preparing',
    'signing',
    'submitting',
    'updating-status',
])

type CardAddFundsSwapOutcome =
    | { kind: 'success' }
    | { kind: 'cancelled' }
    // Shared-account swap proposed; co-signer must approve before it submits.
    | { kind: 'pending-cosign' }
    // title is only set for a resolved submission-phase failure; other
    // phases fall back to the caller's default title.
    | { kind: 'error'; message: string; title?: string }

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
 * Fetches quotes via the shared `useSwapQuotes` (fixed-input, output pinned to
 * USDC), picks the best one, and runs it through `useSwapExecution`.
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
    const { allQuotes, isQuoteFetching } = useSwapQuotes({
        enabled,
        swapperAddress: account?.address ?? null,
        fromAssetId: sourceAssetId,
        toAssetId: usdcAssetId,
        payAmount: amount,
        payDecimals: sourceDecimals,
    })

    const quote = useMemo(() => pickBestByAmountOut(allQuotes), [allQuotes])
    const rate = useMemo(() => (quote ? formatSwapRate(quote) : null), [quote])
    const usdcOut = useMemo(
        () =>
            quote?.amountOut
                ? baseUnitsToDisplayUnits(quote.amountOut, usdcDecimals)
                : null,
        [quote, usdcDecimals],
    )

    const { execute, status } = useSwapExecution()
    const isSwapping = SWAPPING_STATUSES.has(status)

    const executeSwap =
        useCallback(async (): Promise<CardAddFundsSwapOutcome> => {
            if (!quote?.quoteIdStr) {
                return { kind: 'error', message: '' }
            }
            const outcome = await execute(quote)
            if (outcome.kind === 'success') return { kind: 'success' }
            if (outcome.kind === 'cancelled') return { kind: 'cancelled' }
            if (outcome.kind === 'pending-cosign') {
                return { kind: 'pending-cosign' }
            }
            if (outcome.kind === 'stale-quote') {
                // The card flow re-quotes continuously; a stale quote here
                // just means this attempt raced the TTL — treat as cancelled
                // so the user re-taps with the already-refreshed rate.
                return { kind: 'cancelled' }
            }
            if (outcome.kind === 'verifying-previous') {
                // An earlier attempt for this swap is still being verified —
                // nothing was re-signed or broadcast. Same treatment as a
                // stale quote: cancelled, so the user re-taps.
                return { kind: 'cancelled' }
            }
            return {
                kind: 'error',
                message: outcome.message,
                title: outcome.title,
            }
        }, [quote, execute])

    return { quote, rate, usdcOut, isQuoteFetching, isSwapping, executeSwap }
}
