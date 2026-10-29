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
import { ALGO_DECIMALS, type Nullable } from '@perawallet/wallet-core-shared'
import type {
    HistoryChainDataCodec,
    TransactionHistoryChainFields,
} from '@perawallet/wallet-core-transactions'
import { resolveAlgorandAssetFacts } from '../history/assetFacts'
import {
    algorandHistoryDataOf,
    type AlgorandHistoryData,
    type AlgorandSwapGroupDetail,
} from '../history-data'

export const CLOSE_TO_PATH = '$.algorand.closeTo'
export const CLOSE_AMOUNT_PATH = '$.algorand.closeAmount'
/** Set by the close-amount backfill when the indexer has no amount; never read back into the item. */
export const CLOSE_AMOUNT_SETTLED_PATH = '$.algorand.closeAmountSettled'
export const SWAP_GROUP_DETAIL_PATH = '$.algorand.swapGroupDetail'
export const SWAP_ASSET_IN_DECIMALS_PATH =
    '$.algorand.swapGroupDetail.assetInDecimals'

export type StoredSwapGroupDetail = Omit<
    AlgorandSwapGroupDetail,
    'amountIn' | 'amountOut'
> & {
    /** Base units, as a decimal string. */
    amountIn: string
    /** Base units, as a decimal string. */
    amountOut: string
}

/**
 * The `algorand` entry of a `transactions.chain_data` document. Absent values
 * are `null` rather than omitted, so every row has the same keys.
 */
type StoredAlgorandChainData = {
    confirmedRound: Nullable<number>
    /** Unix seconds. */
    roundTime: Nullable<number>
    innerTransactionCount: Nullable<number>
    /** Decimal string: a uint64 id never lives in a JS number. */
    applicationId: Nullable<string>
    closeTo: Nullable<string>
    swapGroupDetail: Nullable<StoredSwapGroupDetail>
    groupId: Nullable<string>
    /** Base units, as a decimal string. */
    // lanekeep-ignore-next-line pera/amount-types reason: JSON document stored in the chain_data column; decoded with new Decimal below
    closeAmount: Nullable<string>
}

type StoredChainData = { algorand?: StoredAlgorandChainData }

/**
 * A cached row carrying no per-side decimals falls back to 6 rather than 0,
 * which would inflate its amounts by six orders of magnitude.
 */
export function restoreSwapGroupDetail(
    parsed: StoredSwapGroupDetail,
): AlgorandSwapGroupDetail {
    const assetIn = resolveAlgorandAssetFacts(parsed.assetInId, {
        unitName: parsed.assetInUnitName,
        decimals: parsed.assetInDecimals ?? ALGO_DECIMALS,
    })
    const assetOut = resolveAlgorandAssetFacts(parsed.assetOutId, {
        unitName: parsed.assetOutUnitName,
        decimals: parsed.assetOutDecimals ?? ALGO_DECIMALS,
    })

    return {
        ...parsed,
        assetInUnitName: assetIn.unitName,
        assetInDecimals: assetIn.decimals,
        assetOutUnitName: assetOut.unitName,
        assetOutDecimals: assetOut.decimals,
        amountIn: new Decimal(parsed.amountIn),
        amountOut: new Decimal(parsed.amountOut),
    }
}

function encode(fields: TransactionHistoryChainFields): string {
    const data = algorandHistoryDataOf(fields)
    const swap = data.swapGroupDetail
    const algorand: StoredAlgorandChainData = {
        confirmedRound: fields.confirmedRound ?? null,
        roundTime: fields.roundTime,
        innerTransactionCount: data.innerTransactionCount,
        applicationId: data.applicationId || null,
        closeTo: data.closeTo,
        swapGroupDetail: swap
            ? {
                  ...swap,
                  amountIn: swap.amountIn.toString(),
                  amountOut: swap.amountOut.toString(),
              }
            : null,
        groupId: data.groupId,
        closeAmount: data.closeAmount?.toString() ?? null,
    }
    return JSON.stringify({ algorand })
}

function decode(json: string): TransactionHistoryChainFields {
    const algorand = (JSON.parse(json) as StoredChainData).algorand
    const chainData: AlgorandHistoryData = {
        family: 'algorand',
        innerTransactionCount: algorand?.innerTransactionCount ?? null,
        applicationId: algorand?.applicationId ?? null,
        closeTo: algorand?.closeTo ?? null,
        swapGroupDetail: algorand?.swapGroupDetail
            ? restoreSwapGroupDetail(algorand.swapGroupDetail)
            : null,
        groupId: algorand?.groupId ?? null,
        closeAmount: algorand?.closeAmount
            ? new Decimal(algorand.closeAmount)
            : null,
    }
    return {
        confirmedRound: algorand?.confirmedRound ?? undefined,
        // Only a chain that can't time a pending transaction leaves this NULL.
        roundTime: algorand?.roundTime ?? 0,
        chainData,
    }
}

export const algorandHistoryChainData: HistoryChainDataCodec = {
    encode,
    decode,
    assetIdPaths: [
        '$.algorand.swapGroupDetail.assetInId',
        '$.algorand.swapGroupDetail.assetOutId',
    ],
    // Only some perspectives can derive the sweep (see deriveCloseAmount).
    stickyPaths: [CLOSE_AMOUNT_PATH],
}
