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

import { queryClient, type Network } from '@perawallet/wallet-core-shared'
import {
    fetchIndexerAssetDetails,
    transformIndexerAssetResponse,
} from '@perawallet/wallet-core-assets'
import { DEFAULT_ITEMS_PER_PAGE } from '../../../models/constants'
import type { TransactionHistoryResult } from '../../../models/types'
import { transformTransactionHistoryResponse } from '../transformers'
import {
    collectAssetIds,
    transformIndexerTransactions,
    type AssetLookup,
} from './transformers'

/**
 * Resolves display facts (name/unit/decimals) for every asset referenced in a
 * page. A single asset lookup failing (e.g. a transient network error) must
 * not sink the whole page — `Promise.allSettled` lets the rest of the page
 * render with that one asset falling back to empty facts in the transformer.
 */
const buildAssetLookup = async (
    response: unknown,
    network: Network,
): Promise<AssetLookup> => {
    const lookup: AssetLookup = new Map()
    const ids = collectAssetIds(response)

    const settled = await Promise.allSettled(
        ids.map(async id => {
            const asset = transformIndexerAssetResponse(
                await fetchIndexerAssetDetails(id, network),
            )
            return { id, asset }
        }),
    )

    for (const outcome of settled) {
        if (outcome.status !== 'fulfilled') continue
        const { id, asset } = outcome.value
        lookup.set(id, {
            name: asset.name,
            unitName: asset.unitName,
            decimals: asset.decimals,
        })
    }

    return lookup
}

const toResult = async (
    raw: unknown,
    accountAddress: string,
    network: Network,
): Promise<TransactionHistoryResult> => {
    const assets = await buildAssetLookup(raw, network)
    return transformTransactionHistoryResponse(
        transformIndexerTransactions(raw, accountAddress, assets),
    )
}

/**
 * Transaction history straight from the active chain's indexer. Used on
 * networks whose Pera services are borrowed: borrowed history would show
 * another chain's transactions, so a payment just sent would never appear.
 */
export const fetchIndexerTransactionHistory = async (params: {
    accountAddress: string
    network: Network
    assetId?: string
    afterTime?: string
    beforeTime?: string
    limit?: number
    signal?: AbortSignal
}): Promise<TransactionHistoryResult> => {
    const {
        accountAddress,
        network,
        assetId,
        afterTime,
        beforeTime,
        limit,
        signal,
    } = params

    const response = await queryClient<unknown>({
        backend: 'indexer',
        network,
        method: 'GET',
        url: `/v2/accounts/${encodeURIComponent(accountAddress)}/transactions`,
        params: {
            limit: limit ?? DEFAULT_ITEMS_PER_PAGE,
            ...(assetId !== undefined ? { 'asset-id': assetId } : {}),
            ...(afterTime !== undefined ? { 'after-time': afterTime } : {}),
            ...(beforeTime !== undefined ? { 'before-time': beforeTime } : {}),
        },
        signal,
    })

    return toResult(response.data, accountAddress, network)
}

/**
 * Next page. The cursor is the indexer's opaque `next-token`, carried in the
 * `next` field of the previous page, plus the address it belongs to — the
 * indexer has no absolute next-page URL to replay.
 */
export const fetchMoreIndexerTransactions = async (params: {
    accountAddress: string
    nextToken: string
    network: Network
    limit?: number
    signal?: AbortSignal
}): Promise<TransactionHistoryResult> => {
    const { accountAddress, nextToken, network, limit, signal } = params

    const response = await queryClient<unknown>({
        backend: 'indexer',
        network,
        method: 'GET',
        url: `/v2/accounts/${encodeURIComponent(accountAddress)}/transactions`,
        params: { limit: limit ?? DEFAULT_ITEMS_PER_PAGE, next: nextToken },
        signal,
    })

    return toResult(response.data, accountAddress, network)
}
