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
    ChainScope,
    Page,
    PageRef,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import type { HistoryChainAdapter } from '@perawallet/wallet-core-transactions'
import type { EvmChain } from '../chains/types'
import { fetchHistoryPage } from './api/endpoints'
import type { EvmHistoryItem } from './api/schema'
import { summarizeEthereumHistoryItem } from './summarize'

// A withdrawal row has no hash; its first EIP-4895 index is unique
// chain-wide. Explorer links must special-case these ids.
const recordId = (item: EvmHistoryItem): string | undefined =>
    item.kind === 'withdrawal'
        ? item.withdrawals[0] && `withdrawal:${item.withdrawals[0].index}`
        : (item.hash ?? undefined)

const toRecords = (
    item: EvmHistoryItem,
    address: string,
    scope: ChainScope,
    chain: EvmChain,
): TransactionRecord[] => {
    const id = recordId(item)
    if (id === undefined) return []
    return [
        {
            id,
            scope,
            status: item.status === 'success' ? 'confirmed' : 'failed',
            timestamp: Date.parse(item.block_time),
            fee: item.fee === null ? undefined : new Decimal(item.fee),
            ...(item.from !== null && { initiator: item.from }),
            summary: summarizeEthereumHistoryItem(item, address, scope, chain),
            chainData: { family: 'evm' },
        },
    ]
}

/**
 * Newest first. A page can be empty and still have `next`. Mined rows only:
 * JSON-RPC can't enumerate history, so there is no fallback.
 */
export const getEvmTransactionHistory = async (
    chain: EvmChain,
    address: string,
    scope: ChainScope,
    page?: PageRef,
): Promise<Page<TransactionRecord>> => {
    const { items, next } = await fetchHistoryPage(scope, chain, address, page)
    return {
        items: items.flatMap(item => toRecords(item, address, scope, chain)),
        ...(next !== null && { next: { cursor: next } }),
    }
}

export const createEvmHistoryAdapter = (
    chain: EvmChain,
): HistoryChainAdapter => ({
    chainId: chain.row.id,
    getTransactionHistory: (address, scope, page) =>
        getEvmTransactionHistory(chain, address, scope, page),
})
