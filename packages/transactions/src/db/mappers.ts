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
import {
    assetRefKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    TransactionHistoryStatuses,
    type TransactionHistoryItem,
    type TransactionHistoryStatus,
    type TransactionBalanceImpact,
    type TransactionAssetSummary,
    type TransactionSwapGroupDetail,
} from '../models/types'
import type { AssetFactsResolver } from '../history-adapter'

/**
 * Serializes balance impacts to JSON for persistence. The signed `amount`
 * Decimal is stored as a string so it round-trips without precision loss.
 */
function serializeBalanceImpacts(
    impacts: TransactionBalanceImpact[],
): Nullable<string> {
    if (impacts.length === 0) return null
    return JSON.stringify(
        impacts.map(impact => ({
            assetId: impact.assetId,
            unitName: impact.unitName,
            fractionDecimals: impact.fractionDecimals,
            amount: impact.amount.toString(),
        })),
    )
}

/**
 * Rehydrates persisted balance impacts, restoring `amount` to a Decimal.
 * Rows persisted before the balance-impacts column existed yield an empty list.
 */
function deserializeBalanceImpacts(
    json: Nullable<string>,
    resolveAssetFacts: AssetFactsResolver,
): TransactionBalanceImpact[] {
    if (!json) return []
    const parsed = JSON.parse(json) as Array<{
        assetId: string
        unitName: string
        fractionDecimals: number
        // lanekeep-ignore-next-line pera/amount-types reason: JSON.parse shape of the stored column; converted with new Decimal below
        amount: string
    }>
    return parsed.map(impact => {
        const facts = resolveAssetFacts(impact.assetId, {
            unitName: impact.unitName,
            decimals: impact.fractionDecimals,
        })

        return {
            assetId: impact.assetId,
            unitName: facts.unitName,
            fractionDecimals: facts.decimals,
            amount: new Decimal(impact.amount),
        }
    })
}

/**
 * Rehydrates a persisted asset summary. The syncer only fetches transactions
 * newer than the newest cached one, so a row that captured the backend's
 * `asset(<id>)` placeholder is never revisited — ALGO's real facts have to be
 * restored on the way out instead.
 */
function deserializeAsset(
    json: Nullable<string>,
    resolveAssetFacts: AssetFactsResolver,
): Nullable<TransactionAssetSummary> {
    if (!json) return null
    const parsed = JSON.parse(json) as TransactionAssetSummary
    const facts = resolveAssetFacts(parsed.assetId, {
        unitName: parsed.unitName,
        decimals: parsed.decimals,
    })

    return { ...parsed, unitName: facts.unitName, decimals: facts.decimals }
}

/**
 * Rehydrates a persisted swap group detail. A cached row carrying no per-side
 * decimals falls back to 6 rather than 0, which would inflate its amounts by
 * six orders of magnitude.
 */
export function deserializeSwapGroupDetail(
    json: Nullable<string>,
    resolveAssetFacts: AssetFactsResolver,
): Nullable<TransactionSwapGroupDetail> {
    if (!json) return null
    const parsed = JSON.parse(json) as TransactionSwapGroupDetail
    const assetIn = resolveAssetFacts(parsed.assetInId, {
        unitName: parsed.assetInUnitName,
        decimals: parsed.assetInDecimals ?? ALGO_DECIMALS,
    })
    const assetOut = resolveAssetFacts(parsed.assetOutId, {
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

type StoredSwapGroupDetail = Omit<
    TransactionSwapGroupDetail,
    'amountIn' | 'amountOut'
> & {
    /** Base units, as a decimal string. */
    // lanekeep-ignore-next-line pera/amount-types reason: serialized shape of the stored chain_data column
    amountIn: string
    /** Base units, as a decimal string. */
    // lanekeep-ignore-next-line pera/amount-types reason: serialized shape of the stored chain_data column
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
    // lanekeep-ignore-next-line pera/amount-types reason: serialized shape of the stored chain_data column
    closeAmount: Nullable<string>
}

// Built from the converted columns, so the two shapes can't drift apart.
function serializeAlgorandChainData(
    columns: ReturnType<typeof toAlgorandColumns>,
    swap: Nullable<TransactionSwapGroupDetail>,
): string {
    const algorand: StoredAlgorandChainData = {
        confirmedRound: columns.confirmedRound,
        roundTime: columns.roundTime,
        innerTransactionCount: columns.innerTransactionCount,
        applicationId: columns.applicationId?.toString() ?? null,
        closeTo: columns.closeTo,
        swapGroupDetail: swap
            ? {
                  ...swap,
                  amountIn: swap.amountIn.toString(),
                  amountOut: swap.amountOut.toString(),
              }
            : null,
        groupId: columns.groupId,
        closeAmount: columns.closeAmount?.toString() ?? null,
    }
    return JSON.stringify({ algorand })
}

function toAlgorandColumns(item: TransactionHistoryItem) {
    return {
        confirmedRound: item.confirmedRound ?? null,
        roundTime: item.roundTime,
        groupId: item.groupId,
        closeTo: item.closeTo,
        closeAmount: item.closeAmount,
        applicationId: item.applicationId
            ? new Decimal(item.applicationId)
            : null,
        innerTransactionCount: item.innerTransactionCount,
    }
}

export function toDb(item: TransactionHistoryItem, scope: ChainScope) {
    const algorandColumns = toAlgorandColumns(item)
    return {
        ...algorandColumns,
        id: item.id,
        txType: item.txType,
        sender: item.sender,
        receiver: item.receiver,
        status: item.status ?? TransactionHistoryStatuses.CONFIRMED,
        fee: item.fee,
        amount: item.amount,
        assetSender: item.assetSender,
        assetJson: item.asset ? JSON.stringify(item.asset) : null,
        swapGroupDetailJson: item.swapGroupDetail
            ? JSON.stringify(item.swapGroupDetail)
            : null,
        interpretedMeaningJson: item.interpretedMeaning
            ? JSON.stringify(item.interpretedMeaning)
            : null,
        balanceImpactsJson: serializeBalanceImpacts(item.balanceImpacts),
        chainData: serializeAlgorandChainData(
            algorandColumns,
            item.swapGroupDetail,
        ),
        assetRef: item.asset
            ? assetRefKey({
                  chainId: scope.chainId,
                  assetId: item.asset.assetId,
              })
            : null,
    }
}

export function fromDb(
    row: {
        id: string
        txType: string
        sender: string
        assetSender: Nullable<string>
        receiver: Nullable<string>
        confirmedRound: Nullable<number>
        roundTime: Nullable<number>
        status: TransactionHistoryStatus
        fee: Decimal
        groupId: Nullable<string>
        amount: Nullable<Decimal>
        closeTo: Nullable<string>
        closeAmount: Nullable<Decimal>
        applicationId: Nullable<Decimal>
        innerTransactionCount: Nullable<number>
        assetJson: Nullable<string>
        swapGroupDetailJson: Nullable<string>
        interpretedMeaningJson: Nullable<string>
        balanceImpactsJson: Nullable<string>
    },
    resolveAssetFacts: AssetFactsResolver,
): TransactionHistoryItem {
    return {
        id: row.id,
        txType: row.txType as TransactionHistoryItem['txType'],
        sender: row.sender,
        assetSender: row.assetSender,
        receiver: row.receiver,
        confirmedRound: row.confirmedRound ?? undefined,
        status: row.status,
        // Only a chain that can't time a pending transaction leaves this NULL.
        roundTime: row.roundTime ?? 0,
        fee: row.fee,
        groupId: row.groupId,
        amount: row.amount,
        closeTo: row.closeTo,
        closeAmount: row.closeAmount,
        applicationId: row.applicationId?.toString() ?? null,
        innerTransactionCount: row.innerTransactionCount,
        asset: deserializeAsset(row.assetJson, resolveAssetFacts),
        swapGroupDetail: deserializeSwapGroupDetail(
            row.swapGroupDetailJson,
            resolveAssetFacts,
        ),
        interpretedMeaning: row.interpretedMeaningJson
            ? JSON.parse(row.interpretedMeaningJson)
            : null,
        balanceImpacts: deserializeBalanceImpacts(
            row.balanceImpactsJson,
            resolveAssetFacts,
        ),
    }
}
