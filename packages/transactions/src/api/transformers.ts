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
} from '../models/types'

/**
 * Transforms a swap group detail from API response format to domain format.
 */
const transformSwapGroupDetail = (
    detail: TransactionHistoryItemApiResponse['swap_group_detail'],
): TransactionSwapGroupDetail | null => {
    if (!detail) return null
    return {
        assetInId: Number(detail.asset_in_id),
        assetInUnitName: detail.asset_in_unit_name,
        assetOutId: Number(detail.asset_out_id),
        assetOutUnitName: detail.asset_out_unit_name,
        amountIn: detail.amount_in,
        amountOut: detail.amount_out,
    }
}

/**
 * Transforms an asset summary from API response format to domain format.
 */
const transformAssetSummary = (
    asset: TransactionHistoryItemApiResponse['asset'],
): TransactionAssetSummary | null => {
    if (!asset) return null
    return {
        assetId: Number(asset.asset_id),
        name: asset.name ?? '',
        unitName: asset.unit_name ?? '',
        decimals: asset.decimals ?? 0,
    }
}

/**
 * Transforms an interpreted meaning from API response format to domain format.
 */
const transformInterpretedMeaning = (
    meaning: TransactionHistoryItemApiResponse['interpreted_meaning'],
): TransactionInterpretedMeaning | null => {
    if (!meaning) return null
    return {
        title: meaning.title,
        description: meaning.description ?? '',
    }
}

/**
 * Transforms a transaction item from API response format (snake_case) to
 * domain format (camelCase).
 */
export const transformTransactionItem = (
    item: TransactionHistoryItemApiResponse,
): TransactionHistoryItem => ({
    id: item.id,
    txType: item.tx_type,
    sender: item.sender,
    receiver: item.receiver ?? null,
    confirmedRound: Number(item.confirmed_round),
    roundTime: Number(item.round_time),
    swapGroupDetail: transformSwapGroupDetail(item.swap_group_detail),
    interpretedMeaning: transformInterpretedMeaning(item.interpreted_meaning),
    fee: item.fee,
    groupId: item.group_id ?? null,
    amount: item.amount ?? null,
    closeTo: item.close_to ?? null,
    asset: transformAssetSummary(item.asset),
    applicationId:
        item.application_id != null ? Number(item.application_id) : null,
    innerTransactionCount:
        item.inner_transaction_count != null
            ? Number(item.inner_transaction_count)
            : null,
})

/**
 * Transforms the full API response to the domain result format.
 */
export const transformTransactionHistoryResponse = (
    response: TransactionHistoryApiResponse,
): TransactionHistoryResult => ({
    transactions: response.results.map(transformTransactionItem),
    pagination: {
        hasNextPage: !!response.next,
        hasPreviousPage: !!response.previous,
        nextUrl: response.next ?? null,
        previousUrl: response.previous ?? null,
        totalFetched: response.results.length,
    },
    currentRound: Number(response.current_round ?? 0),
})
