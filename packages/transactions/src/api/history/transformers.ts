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

import { Decimal } from 'decimal.js'
import type {
    TransactionHistoryItemApiResponse,
    TransactionHistoryApiResponse,
} from './schema'
import type {
    TransactionHistoryItem,
    TransactionHistoryResult,
    TransactionAssetSummary,
    TransactionSwapGroupDetail,
    TransactionInterpretedMeaning,
    TransactionBalanceImpact,
} from '../../models/types'
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * Transforms a swap group detail from API response format to domain format.
 */
const transformSwapGroupDetail = (
    detail: TransactionHistoryItemApiResponse['swap_group_detail'],
): Nullable<TransactionSwapGroupDetail> => {
    if (!detail) return null
    return {
        assetInId: detail.asset_in_id ?? null,
        assetInUnitName: detail.asset_in_unit_name ?? '',
        assetOutId: detail.asset_out_id ?? null,
        assetOutUnitName: detail.asset_out_unit_name ?? '',
        amountIn: new Decimal(detail.amount_in ?? '0'),
        amountOut: new Decimal(detail.amount_out ?? '0'),
    }
}

/**
 * Transforms an asset summary from API response format to domain format.
 */
const transformAssetSummary = (
    asset: TransactionHistoryItemApiResponse['asset'],
): Nullable<TransactionAssetSummary> => {
    if (!asset) return null
    return {
        assetId: asset.asset_id,
        name: asset.name ?? '',
        unitName: asset.unit_name ?? '',
        decimals: asset.decimals ?? 0,
    }
}

/**
 * Transforms the balance-impact list from API response format to domain format.
 * Defaults to an empty array when the API omits the field.
 */
const transformBalanceImpacts = (
    impacts: TransactionHistoryItemApiResponse['balance_impacts'],
): TransactionBalanceImpact[] =>
    (impacts ?? []).map(impact => ({
        assetId: impact.asset_id,
        unitName: impact.unit_name ?? '',
        fractionDecimals: impact.fraction_decimals ?? 0,
        amount: new Decimal(impact.amount),
    }))

/**
 * Transforms an interpreted meaning from API response format to domain format.
 */
const transformInterpretedMeaning = (
    meaning: TransactionHistoryItemApiResponse['interpreted_meaning'],
): Nullable<TransactionInterpretedMeaning> => {
    if (!meaning) return null
    return {
        title: meaning.title ?? '',
        description: meaning.description ?? '',
    }
}

const ALGO_IMPACT_KEY = '0'
const ZERO = new Decimal(0)

/**
 * The Pera backend does not send `close_amount`, but its per-account balance
 * impacts contain the swept value exactly: the sender's impact nets
 * amount + close (+ fee on the ALGO impact), and the close target's impact is
 * the sweep itself (+ amount when it is also the receiver). Deriving here
 * keeps close-outs rendering correctly without a backend contract change; an
 * explicit `close_amount` (the indexer path) always wins.
 */
const deriveCloseAmount = (
    item: TransactionHistoryItemApiResponse,
    accountAddress?: string,
): Nullable<Decimal> => {
    if (!accountAddress || !item.close_to || !item.balance_impacts?.length) {
        return null
    }
    if (item.tx_type !== 'pay' && item.tx_type !== 'axfer') return null

    const isPay = item.tx_type === 'pay'
    const impactKey = isPay ? ALGO_IMPACT_KEY : item.asset?.asset_id
    const impact = item.balance_impacts.find(i => i.asset_id === impactKey)
    if (!impact) return null

    const impactAmount = new Decimal(impact.amount)
    const paid = new Decimal(item.amount ?? '0')

    let closed: Nullable<Decimal> = null
    if (item.sender === accountAddress) {
        const fee = isPay ? new Decimal(item.fee) : ZERO
        closed = impactAmount.negated().sub(paid).sub(fee)
    } else if (item.close_to === accountAddress) {
        closed = impactAmount.sub(
            item.receiver === accountAddress ? paid : ZERO,
        )
    }

    // A receiver-only perspective can't see the sweep; a non-positive result
    // means the impact didn't have the expected shape — don't guess.
    return closed && closed.gt(0) ? closed : null
}

/**
 * Transforms a transaction item from API response format (snake_case) to
 * domain format (camelCase). `accountAddress` is the account the page was
 * fetched for — it powers the close-amount derivation above.
 */
export const transformTransactionItem = (
    item: TransactionHistoryItemApiResponse,
    accountAddress?: string,
): TransactionHistoryItem => ({
    id: item.id,
    txType: item.tx_type,
    sender: item.sender,
    receiver: item.receiver ?? null,
    confirmedRound: Number(item.confirmed_round),
    roundTime: Number(item.round_time),
    swapGroupDetail: transformSwapGroupDetail(item.swap_group_detail),
    interpretedMeaning: transformInterpretedMeaning(item.interpreted_meaning),
    fee: new Decimal(item.fee),
    groupId: item.group_id ?? null,
    amount:
        item.amount !== undefined && item.amount !== null
            ? new Decimal(item.amount)
            : null,
    closeTo: item.close_to ?? null,
    closeAmount:
        item.close_amount !== undefined && item.close_amount !== null
            ? new Decimal(item.close_amount)
            : deriveCloseAmount(item, accountAddress),
    asset: transformAssetSummary(item.asset),
    applicationId: item.application_id ?? null,
    innerTransactionCount:
        item.inner_transaction_count != null
            ? Number(item.inner_transaction_count)
            : null,
    balanceImpacts: transformBalanceImpacts(item.balance_impacts),
})

/**
 * Transforms the full API response to the domain result format.
 */
export const transformTransactionHistoryResponse = (
    response: TransactionHistoryApiResponse,
    accountAddress?: string,
): TransactionHistoryResult => ({
    transactions: response.results.map(item =>
        transformTransactionItem(item, accountAddress),
    ),
    pagination: {
        hasNextPage: !!response.next,
        hasPreviousPage: !!response.previous,
        nextUrl: response.next ?? null,
        previousUrl: response.previous ?? null,
        totalFetched: response.results.length,
    },
    currentRound: Number(response.current_round ?? 0),
})
