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
import { z } from 'zod'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { logger, type Optional } from '@perawallet/wallet-core-shared'
import {
    getTransactionHistory,
    upsertTransactions,
    type HistoryChainDataCodec,
    type TransactionHistoryChainFields,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import { evmHistoryItemSchema, type EvmHistoryItem } from './api/schema'
import { evmHistoryRecordId } from './records'

type BalanceImpacts = EvmHistoryItem['balance_impacts']

/**
 * The `TransactionHistoryItem.chainData` of a stored EVM row. `item` carries
 * the chain's facts with no balance impacts: the backend reads those from the
 * asking account's side, so each account's own live under its lowercase
 * address in `impactsByAccount`.
 */
export type EvmStoredHistoryData = {
    family: 'evm'
    item: EvmHistoryItem
    impactsByAccount: Record<string, BalanceImpacts>
}

const impactsByAccountSchema = z.record(
    z.string(),
    evmHistoryItemSchema.shape.balance_impacts,
)

const roundTimeOf = (item: EvmHistoryItem): number =>
    Math.floor(Date.parse(item.block_time) / 1000)

const isEvmStoredHistoryData = (
    value: unknown,
): value is EvmStoredHistoryData =>
    typeof value === 'object' &&
    value !== null &&
    (value as { family?: unknown }).family === 'evm'

export const evmHistoryChainData: HistoryChainDataCodec = {
    encode: (fields: TransactionHistoryChainFields): string => {
        if (!isEvmStoredHistoryData(fields.chainData)) {
            throw new Error('evm history: chain data is not an EVM item')
        }
        return JSON.stringify({
            evm: fields.chainData.item,
            impacts: fields.chainData.impactsByAccount,
        })
    },
    decode: (json: string): TransactionHistoryChainFields => {
        const document = JSON.parse(json) as {
            evm?: unknown
            impacts?: unknown
        }
        const item = evmHistoryItemSchema.parse(document.evm)
        return {
            confirmedRound: item.block_number,
            roundTime: roundTimeOf(item),
            chainData: {
                family: 'evm',
                item,
                impactsByAccount: impactsByAccountSchema.parse(
                    document.impacts ?? {},
                ),
            } satisfies EvmStoredHistoryData,
        }
    },
    assetIdPaths: [],
    // The row is shared by every own account a transaction touches, and the
    // backend leaves these null for a reading from a side that didn't send it.
    stickyPaths: [
        '$.evm.from',
        '$.evm.to',
        '$.evm.value',
        '$.evm.fee',
        '$.evm.method',
        '$.evm.input',
    ],
    mergedObjectPaths: ['$.impacts'],
}

/**
 * The top-level columns hold the chain's facts for validity only; every
 * per-account reading is derived from `chainData` at export time.
 */
export const toEvmHistoryRow = (
    item: EvmHistoryItem,
    address: string,
): Optional<TransactionHistoryItem> => {
    const id = evmHistoryRecordId(item)
    if (id === undefined) return undefined
    return {
        id,
        txType: item.kind,
        sender: item.from ?? '',
        assetSender: null,
        receiver: item.to,
        confirmedRound: item.block_number,
        status: item.status === 'success' ? 'confirmed' : 'failed',
        roundTime: roundTimeOf(item),
        interpretedMeaning: null,
        // The column is NOT NULL; the export reads the item's own nullable fee.
        fee: new Decimal(item.fee ?? 0),
        amount: item.value === null ? null : new Decimal(item.value),
        asset: null,
        balanceImpacts: [],
        chainData: {
            family: 'evm',
            item: { ...item, balance_impacts: [] },
            impactsByAccount: { [address.toLowerCase()]: item.balance_impacts },
        } satisfies EvmStoredHistoryData,
    }
}

/** Never rejects: a failed write must not fail the history read that fetched the page. */
export const storeEvmHistoryPage = async (
    items: readonly EvmHistoryItem[],
    address: string,
    scope: ChainScope,
): Promise<void> => {
    try {
        await upsertTransactions({
            items: items.flatMap(item => toEvmHistoryRow(item, address) ?? []),
            accountAddress: address,
            scope,
        })
    } catch (error) {
        logger.warn('evm history: storing a page failed', {
            error,
            chainId: scope.chainId,
        })
    }
}

export type ReadStoredEvmHistoryParams = {
    address: string
    scope: ChainScope
    /** `YYYY-MM-DD`, inclusive, UTC. */
    afterTime?: string
    /** `YYYY-MM-DD`, inclusive, UTC. */
    beforeTime?: string
    limit: number
}

/** Newest first. */
export const readStoredEvmHistory = async ({
    address,
    scope,
    afterTime,
    beforeTime,
    limit,
}: ReadStoredEvmHistoryParams): Promise<EvmHistoryItem[]> => {
    const rows = await getTransactionHistory({
        accountAddress: address,
        scope,
        afterTime,
        beforeTime,
        limit,
    })
    const owner = address.toLowerCase()
    return rows.flatMap(row =>
        isEvmStoredHistoryData(row.chainData)
            ? [
                  {
                      ...row.chainData.item,
                      balance_impacts:
                          row.chainData.impactsByAccount[owner] ?? [],
                  },
              ]
            : [],
    )
}
