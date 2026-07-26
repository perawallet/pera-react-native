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
import {
    toBigInt,
    type PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { TransactionTypes, type TransactionHistoryItem } from '../models'

const toAmountBigInt = (amount: TransactionHistoryItem['amount']): bigint =>
    toBigInt(amount ?? new Decimal(0))

/**
 * Maps a SQLite history row to the displayable shape Transaction Details
 * renders, so the screen can serve local data while the indexer is
 * unreachable. The row is a lossy summary: only `pay`, `axfer` and `appl`
 * carry enough data to render honestly — other types (and `axfer` rows
 * missing their asset summary) return `null`, and the caller falls back to
 * the fetch-based states. Fields the row does not store (note bytes, inner
 * transactions, app args) are left undefined; the detail sub-displays
 * self-hide those rows.
 */
export const mapHistoryItemToDisplayableTransaction = (
    item: TransactionHistoryItem,
): PeraDisplayableTransaction | null => {
    const base: PeraDisplayableTransaction = {
        id: item.id,
        txType: item.txType,
        sender: item.sender,
        fee: toBigInt(item.fee),
        firstValid: 0n,
        lastValid: 0n,
        confirmedRound: BigInt(item.confirmedRound),
        roundTime: item.roundTime,
        roundTimeMillis: item.roundTime * 1000,
    }

    switch (item.txType) {
        case TransactionTypes.PAY: {
            return {
                ...base,
                paymentTransaction: {
                    amount: toAmountBigInt(item.amount),
                    receiver: item.receiver ?? '',
                    closeRemainderTo: item.closeTo ?? undefined,
                },
            }
        }
        case TransactionTypes.AXFER: {
            if (!item.asset) {
                return null
            }
            return {
                ...base,
                assetTransferTransaction: {
                    assetId: BigInt(item.asset.assetId),
                    amount: toAmountBigInt(item.amount),
                    receiver: item.receiver ?? '',
                    closeTo: item.closeTo ?? undefined,
                    sender: undefined,
                },
            }
        }
        case TransactionTypes.APPL: {
            return {
                ...base,
                innerTransactionCount: item.innerTransactionCount ?? undefined,
                applicationTransaction: {
                    applicationId: BigInt(item.applicationId ?? '0'),
                },
            }
        }
        default: {
            return null
        }
    }
}
