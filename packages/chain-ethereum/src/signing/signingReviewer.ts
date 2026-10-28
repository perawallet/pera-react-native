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

import { bytesToHex, hexToBytes, isHex } from 'viem'
import type {
    TransactionNative,
    TransactionReviewer,
} from '@perawallet/wallet-core-chain-contract'
import { decodePrintableUtf8 } from '@perawallet/wallet-core-shared'
import {
    bridgeTransactionReviewer,
    isTransactionRequest,
    isUnsignedTransactionRequest,
    type ArbitraryDataDisplay,
    type ReviewerChainAdapter,
    type SingleTransactionItem,
} from '@perawallet/wallet-core-signing'
import type { EvmChain } from '../chains/types'
import { isRecord, readEvmTransaction } from './adapter'
import { createEthereumReviewer, ethereumViewOf } from './review'
import { ethereumReviewedAddresses } from './reviewed-addresses'
import { toEthereumNative } from './transaction-view'

const isPreview = (transaction: TransactionNative): boolean =>
    isRecord(transaction.transaction) &&
    transaction.transaction.isPreview === true

// Ethereum has no atomic groups, so every transaction is its own item. A batch
// preview isn't signed by this review, but the wallet signs it later, so it
// isn't someone else's.
const toItems = (
    transactions: TransactionNative[],
    signableIndices?: ReadonlySet<number>,
): SingleTransactionItem[] =>
    transactions.map((transaction, groupIndex) => ({
        type: 'transaction',
        transaction,
        groupIndex,
        isExternal:
            signableIndices !== undefined &&
            !signableIndices.has(groupIndex) &&
            !isPreview(transaction),
    }))

// Only hex payloads are read as text; anything not cleanly printable UTF-8 shows as hex, never lossy.
const decodeArbitraryDataForDisplay = (data: string): ArbitraryDataDisplay => {
    if (!isHex(data, { strict: true })) {
        return { kind: 'hex', hex: bytesToHex(new TextEncoder().encode(data)) }
    }
    const bytes = hexToBytes(data)
    const text = decodePrintableUtf8(bytes)
    return text === undefined
        ? { kind: 'hex', hex: bytesToHex(bytes) }
        : { kind: 'text', text }
}

/** Decoder, warnings and policy are the chain-contract reviewer's, so review behaves the same whichever registry serves it. */
export const createEvmSigningReviewerAdapter = (
    chain: EvmChain,
    reviewer: TransactionReviewer = createEthereumReviewer({ chain }),
): ReviewerChainAdapter => ({
    ...bridgeTransactionReviewer(reviewer),
    chainId: chain.row.id,
    createTransactionListItems: toItems,
    classifyRequestStructure: items => (items.length > 1 ? 'list' : 'single'),
    // The reviewer's warnings already cover every transaction.
    aggregateTransactionWarnings: () => [],
    resolveAllSignerAddresses: request => {
        if (!isTransactionRequest(request)) return []
        if (!isUnsignedTransactionRequest(request)) return []
        return request.txs.flatMap(unsigned => {
            try {
                return [readEvmTransaction(unsigned, chain).from]
            } catch {
                return []
            }
        })
    },
    // No rekeying on Ethereum.
    getDelegatedUnsignableReason: () => null,
    decodeArbitraryDataForDisplay,
    reviewedAddresses: ethereumReviewedAddresses,
    toTransactionNative: transaction => {
        if (!('payload' in transaction)) return null
        const view = ethereumViewOf(transaction, chain)
        return view && toEthereumNative(view)
    },
})
