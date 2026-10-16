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
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    TransactionHistoryStatuses,
    type TransactionHistoryItem,
    type TransactionHistoryStatus,
    type TransactionBalanceImpact,
    type TransactionAssetSummary,
} from '../models/types'
import type {
    AssetFactsResolver,
    HistoryChainDataCodec,
} from '../history-adapter'

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

export function toDb(
    item: TransactionHistoryItem,
    codec: HistoryChainDataCodec,
) {
    return {
        id: item.id,
        txType: item.txType,
        sender: item.sender,
        receiver: item.receiver,
        status: item.status ?? TransactionHistoryStatuses.CONFIRMED,
        fee: item.fee,
        amount: item.amount,
        assetSender: item.assetSender,
        assetJson: item.asset ? JSON.stringify(item.asset) : null,
        interpretedMeaningJson: item.interpretedMeaning
            ? JSON.stringify(item.interpretedMeaning)
            : null,
        balanceImpactsJson: serializeBalanceImpacts(item.balanceImpacts),
        chainData: codec.encode(item),
    }
}

export function fromDb(
    row: {
        id: string
        txType: string
        sender: string
        assetSender: Nullable<string>
        receiver: Nullable<string>
        status: TransactionHistoryStatus
        fee: Decimal
        amount: Nullable<Decimal>
        assetJson: Nullable<string>
        interpretedMeaningJson: Nullable<string>
        balanceImpactsJson: Nullable<string>
        chainData: string
    },
    resolveAssetFacts: AssetFactsResolver,
    codec: HistoryChainDataCodec,
): TransactionHistoryItem {
    return {
        id: row.id,
        txType: row.txType,
        sender: row.sender,
        assetSender: row.assetSender,
        receiver: row.receiver,
        status: row.status,
        fee: row.fee,
        amount: row.amount,
        ...codec.decode(row.chainData),
        asset: deserializeAsset(row.assetJson, resolveAssetFacts),
        interpretedMeaning: row.interpretedMeaningJson
            ? JSON.parse(row.interpretedMeaningJson)
            : null,
        balanceImpacts: deserializeBalanceImpacts(
            row.balanceImpactsJson,
            resolveAssetFacts,
        ),
    }
}
