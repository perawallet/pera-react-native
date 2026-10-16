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
import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
import { decodePrintableUtf8 } from '@perawallet/wallet-core-shared'
import {
    bridgeTransactionReviewer,
    isTransactionRequest,
    isUnsignedTransactionRequest,
    type ArbitraryDataDisplay,
    type ReviewerChainAdapter,
    type SingleTransactionItem,
} from '@perawallet/wallet-core-signing'
import { ETHEREUM_CHAIN_ID } from '../chain-id'
import { readEthereumTransaction } from './adapter'
import { ethereumReviewerAdapter, ethereumViewOf } from './review'
import { toEthereumNative } from './transaction-view'

// Ethereum has no atomic groups, so every transaction is its own item.
const toItems = (
    transactions: TransactionNative[],
    signableIndices?: ReadonlySet<number>,
): SingleTransactionItem[] =>
    transactions.map((transaction, groupIndex) => ({
        type: 'transaction',
        transaction,
        groupIndex,
        isExternal: signableIndices ? !signableIndices.has(groupIndex) : false,
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
export const ethereumSigningReviewerAdapter: ReviewerChainAdapter = {
    ...bridgeTransactionReviewer(ethereumReviewerAdapter),
    chainId: ETHEREUM_CHAIN_ID,
    createTransactionListItems: toItems,
    classifyRequestStructure: items => (items.length > 1 ? 'list' : 'single'),
    // The reviewer's warnings already cover every transaction.
    aggregateTransactionWarnings: () => [],
    resolveAllSignerAddresses: request => {
        if (!isTransactionRequest(request)) return []
        if (!isUnsignedTransactionRequest(request)) return []
        return request.txs.flatMap(unsigned => {
            try {
                return [readEthereumTransaction(unsigned).from]
            } catch {
                return []
            }
        })
    },
    // No rekeying on Ethereum.
    getDelegatedUnsignableReason: () => null,
    decodeArbitraryDataForDisplay,
    toTransactionNative: transaction => {
        if (!('payload' in transaction)) return null
        const view = ethereumViewOf(transaction)
        return view && toEthereumNative(view)
    },
}
