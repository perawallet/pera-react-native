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
    TransactionHistoryItem,
    TransactionBalanceImpact,
    TransactionAssetSummary,
    TransactionSwapGroupDetail,
} from '../models/types'
import { resolveAssetFacts } from '../utils/algoAssetFacts'

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

export function toDb(item: TransactionHistoryItem) {
    return {
        id: item.id,
        txType: item.txType,
        sender: item.sender,
        receiver: item.receiver,
        confirmedRound: item.confirmedRound,
        roundTime: item.roundTime,
        fee: item.fee,
        groupId: item.groupId,
        amount: item.amount,
        closeTo: item.closeTo,
        closeAmount: item.closeAmount,
        applicationId: item.applicationId
            ? new Decimal(item.applicationId)
            : null,
        innerTransactionCount: item.innerTransactionCount,
        assetSender: item.assetSender,
        assetJson: item.asset ? JSON.stringify(item.asset) : null,
        swapGroupDetailJson: item.swapGroupDetail
            ? JSON.stringify(item.swapGroupDetail)
            : null,
        interpretedMeaningJson: item.interpretedMeaning
            ? JSON.stringify(item.interpretedMeaning)
            : null,
        balanceImpactsJson: serializeBalanceImpacts(item.balanceImpacts),
    }
}

export function fromDb(row: {
    id: string
    txType: string
    sender: string
    assetSender: Nullable<string>
    receiver: Nullable<string>
    confirmedRound: number
    roundTime: number
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
}): TransactionHistoryItem {
    return {
        id: row.id,
        txType: row.txType as TransactionHistoryItem['txType'],
        sender: row.sender,
        assetSender: row.assetSender,
        receiver: row.receiver,
        confirmedRound: row.confirmedRound,
        roundTime: row.roundTime,
        fee: row.fee,
        groupId: row.groupId,
        amount: row.amount,
        closeTo: row.closeTo,
        closeAmount: row.closeAmount,
        applicationId: row.applicationId?.toString() ?? null,
        innerTransactionCount: row.innerTransactionCount,
        asset: deserializeAsset(row.assetJson),
        swapGroupDetail: deserializeSwapGroupDetail(row.swapGroupDetailJson),
        interpretedMeaning: row.interpretedMeaningJson
            ? JSON.parse(row.interpretedMeaningJson)
            : null,
        balanceImpacts: deserializeBalanceImpacts(row.balanceImpactsJson),
    }
}
