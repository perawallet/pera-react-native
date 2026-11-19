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
    ChainContext,
    ChainScope,
    Page,
    PageRef,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import type { HistoryChainAdapter } from '@perawallet/wallet-core-transactions'
import type { Optional } from '@perawallet/wallet-core-shared'
import { isEvmNftAssetId, toCaip19 } from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import { fetchHistoryPage } from './api/endpoints'
import type { EvmHistoryItem } from './api/schema'
import { readEvmTransactionDetail } from './detail'
import { readNftApprovals } from './nft-approvals'
import { singleNftOf, summarizeEthereumHistoryItem } from './summarize'

// A withdrawal row has no hash; its first EIP-4895 index is unique
// chain-wide. Explorer links must special-case these ids.
const recordId = (item: EvmHistoryItem): Optional<string> =>
    item.kind === 'withdrawal'
        ? item.withdrawals[0] && `withdrawal:${item.withdrawals[0].index}`
        : (item.hash ?? undefined)

const toRecords = (
    item: EvmHistoryItem,
    address: string,
    scope: ChainScope,
    chain: EvmChain,
    isDecoding: boolean,
    nftApprovals: ReadonlySet<string>,
): TransactionRecord[] => {
    const id = recordId(item)
    if (id === undefined) return []
    const summary = summarizeEthereumHistoryItem(
        item,
        address,
        scope,
        chain,
        isDecoding,
        nftApprovals,
    )
    const nft = singleNftOf(item, address, summary)
    return [
        {
            id,
            scope,
            status: item.status === 'success' ? 'confirmed' : 'failed',
            timestamp: Date.parse(item.block_time),
            ...(item.block_number !== undefined && {
                blockNumber: item.block_number,
            }),
            // No `from` means the row is known only from a transfer log. Read
            // unfiltered, another address signed it and the gas was never this
            // account's; an ERC-20 view names no sender on any row, so there
            // the account's own sends lose their fee and initiator too.
            fee:
                item.fee === null || item.from === null
                    ? undefined
                    : new Decimal(item.fee),
            ...(item.from !== null && { initiator: item.from }),
            summary,
            chainData: { family: 'evm', ...(nft && { nft }) },
        },
    ]
}

// Only an ERC-20's view is asked for. The backend filters no NFT view, and its
// native view strips the other assets' legs from each row, so a token send
// would read as a call that moved nothing and stay in the native History.
const filterIdOf = (
    assetId: Optional<string>,
    scope: ChainScope,
    chain: EvmChain,
): Optional<string> => {
    if (
        assetId === undefined ||
        assetId === chain.nativeAsset.assetId ||
        isEvmNftAssetId(assetId)
    ) {
        return undefined
    }
    // An id this client can't place still filters client-side; a thrown read
    // would fail the screen instead of listing nothing.
    try {
        return toCaip19(assetId, scope, chain)
    } catch {
        return undefined
    }
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
    isDecoding = false,
    assetId?: string,
    signal?: AbortSignal,
): Promise<Page<TransactionRecord>> => {
    const caip19AssetId = filterIdOf(assetId, scope, chain)
    const { items, next } = await fetchHistoryPage(
        scope,
        chain,
        address,
        page,
        { caip19AssetId, signal },
    )
    const nftApprovals = await readNftApprovals(items, address, scope)
    return {
        items: items.flatMap(item =>
            toRecords(item, address, scope, chain, isDecoding, nftApprovals),
        ),
        ...(next !== null && { next: { cursor: next } }),
    }
}

/**
 * The capability arrives with every page read, so a change applies from the
 * next one. The history read itself never touches the node; only
 * `getTransactionDetail` does.
 */
export const createEvmHistoryAdapter = (
    chain: EvmChain,
    ctx: ChainContext,
): HistoryChainAdapter => ({
    chainId: chain.row.id,
    getTransactionHistory: (address, scope, page, options) =>
        getEvmTransactionHistory(
            chain,
            address,
            scope,
            page,
            options?.capabilities.contractDecoding ?? false,
            options?.assetId,
            options?.signal,
        ),
    getTransactionDetail: (txId, scope, record) =>
        readEvmTransactionDetail(ctx, chain, scope, txId, record.fee),
})
