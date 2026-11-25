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

import { ALGORAND_ZERO_ADDRESS_STRING } from 'algosdk'
import type { Decimal } from 'decimal.js'
import {
    swapFeeOf,
    SwapQuoteMismatchError,
    swapSpendLimit,
    type SwapQuote,
} from '@perawallet/wallet-core-swaps'
import type { Optional } from '@perawallet/wallet-core-shared'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandDescriptor, isAlgorandNativeAssetId } from '../descriptor'
import { DEFAULT_FEE_ALLOWANCE_MICRO_ALGO } from '../signing/fees'
import { isAlgoFee } from './computeSwapAlgoShortfall'
import type { PeraDisplayableTransaction } from '../blockchain/models/algosdk-shapes'

// Bounds the swapper's fees together with any small native-ALGO movement a
// provider routes through a payment `amount`. A router pools its inner fees on
// the user's slot (~0.07 ALGO seen on Haystack), so this keeps headroom above
// that while bounding an unexpected ALGO drain to a negligible amount.
const NETWORK_FEE_ALLOWANCE_MICRO_ALGO = 100_000n // 0.1 ALGO
// A quote whose ALGO network fee is higher (multi-hop, pooled) lifts the bound
// on the slots' fees, never on payments, to that fee plus a tenth. The quote
// comes from the backend that builds the group, so the lift stops at the
// signing pipeline's group fee ceiling.
const QUOTED_NETWORK_FEE_MARGIN_DIVISOR = 10n

// A same-chain swap signs transfers to the router and calls into it; any other
// type, or an app call that updates, deletes or leaves an app, does nothing a
// swap needs and moves no outflow this check could bound.
const SWAP_TX_TYPES: ReadonlySet<string> = new Set(['pay', 'axfer', 'appl'])
const SWAP_APP_ON_COMPLETIONS: ReadonlySet<string> = new Set(['noop', 'optin'])

const toBig = (value: bigint | number | undefined): bigint => {
    if (typeof value === 'bigint') return value
    if (typeof value === 'number') return BigInt(Math.trunc(value))
    return 0n
}

/** Ceil a base-unit Decimal to a bigint upper bound (never under-bounds). */
const ceilToBig = (value: Optional<Decimal>): bigint =>
    value ? BigInt(value.ceil().toFixed(0)) : 0n

// A cross-chain source leg only moves funds to the provider; the router
// accepts nothing else and caps the leg's fees at the same 0.1 ALGO.
const CROSS_CHAIN_TX_TYPES: ReadonlySet<string> = new Set(['pay', 'axfer'])
const CROSS_CHAIN_FEE_LIMIT_MICRO_ALGO = 100_000n

const receiverOf = (tx: PeraDisplayableTransaction): Optional<string> => {
    const payment = tx.paymentTransaction
    if (payment && toBig(payment.amount) > 0n) return payment.receiver
    const axfer = tx.assetTransferTransaction
    if (axfer && toBig(axfer.amount) > 0n) return axfer.receiver
    return undefined
}

/**
 * The rules a cross-chain source leg adds: pay/axfer only, the summed fee
 * within the router's cap, and every non-zero transfer to one receiver that is
 * neither the swapper nor the zero address, exactly the deposit address when
 * the quote names one. A quote that names none leaves the request bound in
 * {@link validateSwapGroupAgainstQuote} to cap what can leave.
 */
const validateCrossChainSourceLeg = (
    signableTransactions: PeraDisplayableTransaction[],
    depositAddress: SwapQuote['depositAddress'],
    swapper: string,
): void => {
    let fees = 0n
    const receivers = new Set<string>()
    for (const tx of signableTransactions) {
        if (!tx.txType || !CROSS_CHAIN_TX_TYPES.has(tx.txType)) {
            throw new SwapQuoteMismatchError(
                'Cross-chain swap leg contains a transaction that is not a transfer',
            )
        }
        fees += toBig(tx.fee)
        const receiver = receiverOf(tx)
        if (receiver === undefined) continue
        if (depositAddress !== null && receiver !== depositAddress) {
            throw new SwapQuoteMismatchError(
                'Cross-chain swap leg pays an address other than the deposit address',
            )
        }
        receivers.add(receiver)
    }
    if (fees > CROSS_CHAIN_FEE_LIMIT_MICRO_ALGO) {
        throw new SwapQuoteMismatchError(
            'Cross-chain swap leg fees exceed the allowed total',
        )
    }
    if (receivers.size > 1) {
        throw new SwapQuoteMismatchError(
            'Cross-chain swap leg pays more than one address',
        )
    }
    const [receiver] = receivers
    if (
        receiver !== undefined &&
        (receiver === swapper || receiver === ALGORAND_ZERO_ADDRESS_STRING)
    ) {
        throw new SwapQuoteMismatchError(
            'Cross-chain swap leg pays back to the sender or to the zero address',
        )
    }
}

/**
 * Fail-closed check that a backend-assembled swap group only spends what the
 * app asked the router for. Swap flows trust the group built by the backend and
 * skip the standard signing review sheet, so this guards against a
 * compromised/buggy backend exfiltrating funds.
 *
 * Verified over the user-signable transactions (those sent by the swapper) —
 * which are the *complete* set of ways the swapper's funds can leave. Inner
 * transactions produced by the DEX app spend the pool/app's funds, not the
 * user's, so they need no inspection here (and the minimum received is enforced
 * on-chain by the router). The checks:
 *  - no rekey of the swapper's account (would hand control to a third party);
 *  - no close-remainder / close-to (a swap must never empty the account/asset);
 *  - only transfers and NoOp/OptIn calls to an existing app;
 *  - the slots' summed fee within the larger of the quoted ALGO network fee
 *    (plus a margin) and a flat allowance, capped at the group fee ceiling;
 *  - ALGO payments within the flat allowance left after fees;
 *  - no outflow of an asset other than the quoted input, ALGO (fees), or the
 *    Pera fee asset (an unexpected asset gets a 0 bound, so it trips over-spend);
 *  - the input / ALGO / Pera-fee asset is not spent beyond the bounds. The
 *    input bound is the request's own amount, never the router's figures; the
 *    Pera fee is the one the confirmation showed. Bounds are additive, so when
 *    the input and Pera-fee asset are the same the allowance is their sum.
 *
 * A cross-chain route adds the source-leg rules of
 * {@link validateCrossChainSourceLeg} on top.
 *
 * Throws {@link SwapQuoteMismatchError} on any violation; callers must treat a
 * throw as "do not sign".
 */
export const validateSwapGroupAgainstQuote = (
    signableTransactions: PeraDisplayableTransaction[],
    quote: SwapQuote,
): void => {
    const swapper = quote.request.sourceAddress
    if (!swapper) {
        throw new SwapQuoteMismatchError(
            'Swap quote is missing the swapper address',
        )
    }

    const spendLimit = swapSpendLimit(quote)
    if (spendLimit.asset.chainId !== ALGORAND_CHAIN_ID) {
        throw new SwapQuoteMismatchError(
            'Swap request spends an asset on another chain',
        )
    }
    const peraFee = swapFeeOf(quote, 'pera')
    const isPeraFeeOnChain = peraFee?.asset.chainId === ALGORAND_CHAIN_ID

    const inputAssetId = spendLimit.asset.assetId
    const peraFeeAssetId = isPeraFeeOnChain ? peraFee?.asset.assetId : undefined
    const maxInput = ceilToBig(spendLimit.amount)
    const maxPeraFee = ceilToBig(isPeraFeeOnChain ? peraFee?.amount : undefined)
    const networkFee = swapFeeOf(quote, 'network')
    const quotedNetworkFee = ceilToBig(
        isAlgoFee(networkFee) ? networkFee?.amount : undefined,
    )
    const quotedNetworkFeeWithMargin =
        quotedNetworkFee + quotedNetworkFee / QUOTED_NETWORK_FEE_MARGIN_DIVISOR
    const quotedFeeBound =
        quotedNetworkFeeWithMargin > NETWORK_FEE_ALLOWANCE_MICRO_ALGO
            ? quotedNetworkFeeWithMargin
            : NETWORK_FEE_ALLOWANCE_MICRO_ALGO
    const feeBound =
        quotedFeeBound < DEFAULT_FEE_ALLOWANCE_MICRO_ALGO
            ? quotedFeeBound
            : DEFAULT_FEE_ALLOWANCE_MICRO_ALGO
    const totalFee = signableTransactions.reduce(
        (sum, tx) => sum + toBig(tx.fee),
        0n,
    )
    if (totalFee > feeBound) {
        throw new SwapQuoteMismatchError(
            'Swap fees exceed the quoted network fee',
        )
    }
    // Fees past the flat allowance are admitted as fees only, so a payment
    // can never spend the quote's lift.
    const feeAboveFlatAllowance =
        totalFee > NETWORK_FEE_ALLOWANCE_MICRO_ALGO
            ? totalFee - NETWORK_FEE_ALLOWANCE_MICRO_ALGO
            : 0n

    // Upper bound the swapper may spend per asset. Anything not listed gets a 0
    // bound, so both an unexpected-asset outflow and an over-spend trip the same
    // check. Bounds are summed: if the input and Pera-fee asset are the same,
    // the allowance is `maxInput + maxPeraFee` (both are spent in that asset).
    // Rounded up so rounding can never falsely reject.
    const boundFor = (assetId: string): bigint =>
        (assetId === inputAssetId ? maxInput : 0n) +
        (assetId === peraFeeAssetId ? maxPeraFee : 0n) +
        (isAlgorandNativeAssetId(assetId)
            ? NETWORK_FEE_ALLOWANCE_MICRO_ALGO + feeAboveFlatAllowance
            : 0n)

    const outflow = new Map<string, bigint>()
    const addOutflow = (assetId: string, amount: bigint): void => {
        outflow.set(assetId, (outflow.get(assetId) ?? 0n) + amount)
    }

    for (const tx of signableTransactions) {
        // Fail closed: a slot the wallet will sign whose sender is not the
        // swapper is outside everything the user reviewed. Skipping it (the
        // previous behaviour) meant its rekey/close/outflow was never
        // inspected — and a wrong `swapper` turned the whole validator into a
        // no-op, since `outflow` is only populated inside this branch, so an
        // arbitrary drain of the account passed.
        if (tx.sender !== swapper) {
            throw new SwapQuoteMismatchError(
                'Swap group contains a signable transaction from an unexpected sender',
            )
        }

        if (tx.rekeyTo) {
            throw new SwapQuoteMismatchError(
                'Swap transaction rekeys the account',
            )
        }

        if (!tx.txType || !SWAP_TX_TYPES.has(tx.txType)) {
            throw new SwapQuoteMismatchError(
                'Swap group contains a transaction type a swap never signs',
            )
        }

        if (tx.txType === 'appl') {
            const app = tx.applicationTransaction
            if (
                !app?.onCompletion ||
                !SWAP_APP_ON_COMPLETIONS.has(app.onCompletion)
            ) {
                throw new SwapQuoteMismatchError(
                    'Swap app call does more than call or opt into the router',
                )
            }
            if (toBig(app.applicationId) === 0n) {
                throw new SwapQuoteMismatchError('Swap app call creates an app')
            }
        }

        addOutflow(algorandDescriptor.nativeAsset.ref.assetId, toBig(tx.fee))

        const payment = tx.paymentTransaction
        if (payment) {
            if (payment.closeRemainderTo) {
                throw new SwapQuoteMismatchError(
                    'Swap transaction closes the account',
                )
            }
            addOutflow(
                algorandDescriptor.nativeAsset.ref.assetId,
                toBig(payment.amount),
            )
        }

        const axfer = tx.assetTransferTransaction
        if (axfer) {
            if (axfer.closeTo) {
                throw new SwapQuoteMismatchError(
                    'Swap transaction closes out an asset',
                )
            }
            addOutflow(axfer.assetId.toString(), toBig(axfer.amount))
        }
    }

    for (const [assetId, spent] of outflow) {
        if (spent > boundFor(assetId)) {
            throw new SwapQuoteMismatchError(
                `Swap spends more of asset ${assetId} than the quote allows`,
            )
        }
    }

    if (quote.routeKind === 'cross-chain') {
        validateCrossChainSourceLeg(
            signableTransactions,
            quote.depositAddress,
            swapper,
        )
    }
}
