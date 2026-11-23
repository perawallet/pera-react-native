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

import type {
    ChainContext,
    ChainScope,
    Page,
    PageRef,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import type { HistoryChainAdapter } from '@perawallet/wallet-core-transactions'
import { logger, type Optional } from '@perawallet/wallet-core-shared'
import { isEvmNftAssetId, toCaip19 } from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import { fetchHistoryPage } from './api/endpoints'
import { exportStoredEvmHistoryCsv } from './csv-export'
import { readEvmTransactionDetail } from './detail'
import { evmHistoryChainData, storeEvmHistoryPage } from './history-cache'
import { keepTokensTheAccountSent } from './kept-tokens'
import { readNftApprovals } from './nft-approvals'
import { toEvmHistoryRecords } from './records'

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

export type EvmHistoryReadOptions = {
    isDecoding?: boolean
    assetId?: string
    signal?: AbortSignal
    isSupplementary?: boolean
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
    {
        isDecoding = false,
        assetId,
        signal,
        isSupplementary,
    }: EvmHistoryReadOptions = {},
): Promise<Page<TransactionRecord>> => {
    const caip19AssetId = filterIdOf(assetId, scope, chain)
    const { items, next } = await fetchHistoryPage(
        scope,
        chain,
        address,
        page,
        { caip19AssetId, signal, isSupplementary },
    )
    try {
        keepTokensTheAccountSent(items, address, scope, chain)
    } catch (error) {
        logger.warn('evm history: keeping moved tokens failed', {
            error,
            chainId: scope.chainId,
        })
    }
    // An ERC-20 view lists that token's transfers alone, and storing one would
    // replace the full row History read from the unfiltered view.
    const [nftApprovals] = await Promise.all([
        readNftApprovals(items, address, scope),
        caip19AssetId === undefined
            ? storeEvmHistoryPage(items, address, scope)
            : undefined,
    ])
    return {
        items: items.flatMap(item =>
            toEvmHistoryRecords(
                item,
                address,
                scope,
                chain,
                isDecoding,
                nftApprovals,
            ),
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
        getEvmTransactionHistory(chain, address, scope, page, {
            isDecoding: options?.capabilities.contractDecoding ?? false,
            assetId: options?.assetId,
            signal: options?.signal,
            isSupplementary: options?.isSupplementary,
        }),
    getTransactionDetail: (txId, scope, record) =>
        readEvmTransactionDetail(ctx, chain, scope, txId, record.fee),
    chainData: evmHistoryChainData,
    exportCsv: params => exportStoredEvmHistoryCsv(chain, params),
})
