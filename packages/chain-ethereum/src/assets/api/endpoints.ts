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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { buildIntegrityHeaders } from '@perawallet/wallet-core-app-integrity'
import { Decimal } from 'decimal.js'
import type { PriceHistoryPoint } from '@perawallet/wallet-core-assets'
import {
    CHART_QUERY_TIMEOUT_MS,
    isPeraNetworkError,
    queryClient,
    type HistoryPeriod,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { eip155ChainIdOf, toCaip19 } from '../../blockchain/utils/caip19'
import type { EvmChain } from '../../chains/types'
import {
    assetItemSchema,
    assetsResponseSchema,
    chartResponseSchema,
    nftHoldingsPageSchema,
    nftItemSchema,
    nftsResponseSchema,
    whitelistResponseSchema,
    type AssetItemSchemaOutput,
    type NftItemSchemaOutput,
} from './schema'
import { toWhitelistRow, type WhitelistRow } from './transformers'

export const ASSETS_SERVICE = 'assets'
export const PRICES_SERVICE = 'prices'
export const NFTS_SERVICE = 'nfts'

export const ASSETS_PATH = '/api/v4/assets/'
// The backend rejects a request naming more ids than this (422).
export const ASSETS_MAX_IDS = 500

export const whitelistPath = (eip155ChainId: number | string): string =>
    `/api/v3/evm/${eip155ChainId}/tokens/`

export const CHART_PATH = '/api/v4/assets/chart/'

export const NFTS_PATH = '/api/v4/nfts/'
// The backend rejects a request naming more ids than this (422).
export const NFTS_MAX_IDS = 100
// A cursor that never ends must fail the read, not hang the account sync.
export const NFT_HOLDINGS_MAX_PAGES = 100

export const nftHoldingsPath = (
    eip155ChainId: number | string,
    address: string,
): string => `/api/v3/evm/${eip155ChainId}/accounts/${address}/nfts/`

/**
 * One entry per id, in request order, null where the row is one this client
 * can't read; at most `ASSETS_MAX_IDS` ids. Rejects with a `PeraNetworkError`
 * on a failed request.
 */
export const fetchAssetItems = async (
    scope: ChainScope,
    chain: EvmChain,
    assetIds: string[],
): Promise<Nullable<AssetItemSchemaOutput>[]> => {
    if (assetIds.length === 0) return []
    const ids = assetIds.map(id => toCaip19(id, scope, chain))
    const { data } = await queryClient<unknown>({
        backend: 'pera',
        service: ASSETS_SERVICE,
        scope,
        method: 'POST',
        url: ASSETS_PATH,
        headers: buildIntegrityHeaders(),
        data: { ids },
    })
    const { results } = assetsResponseSchema.parse(data)
    // Items carry no key of their own beyond position, so a misaligned answer
    // would cache one token's decimals under another's id.
    if (
        results.length !== ids.length ||
        results.some(
            (item, index) => item.asset_id.toLowerCase() !== ids[index],
        )
    ) {
        throw new Error(
            `Pera assets for ${scope.chainId}/${scope.networkId} answered out of request order`,
        )
    }
    return results.map(row => {
        const parsed = assetItemSchema.safeParse(row)
        return parsed.success ? parsed.data : null
    })
}

/**
 * The backend's listed tokens for the scope's chain, native first; rows this
 * client can't use are skipped. Rejects with a `PeraNetworkError` on a failed
 * request.
 */
export const fetchWhitelist = async (
    scope: ChainScope,
    chain: EvmChain,
): Promise<WhitelistRow[]> => {
    const { data } = await queryClient<unknown>({
        backend: 'pera',
        service: ASSETS_SERVICE,
        scope,
        method: 'GET',
        url: whitelistPath(eip155ChainIdOf(scope, chain)),
        headers: buildIntegrityHeaders(),
    })
    const { results } = whitelistResponseSchema.parse(data)
    return results.flatMap(row => toWhitelistRow(row, scope, chain) ?? [])
}

/**
 * Every NFT `address` holds on the scope's chain, across all pages; a row
 * this client can't read is skipped. Rejects with a `PeraNetworkError` on a
 * failed page, so a partial list never stands in for the whole.
 */
export const fetchNftHoldings = async (
    scope: ChainScope,
    chain: EvmChain,
    address: string,
): Promise<NftItemSchemaOutput[]> => {
    const url = nftHoldingsPath(
        eip155ChainIdOf(scope, chain),
        address.toLowerCase(),
    )
    const items = new Map<string, NftItemSchemaOutput>()
    let cursor: Nullable<string> = null
    for (let page = 0; page < NFT_HOLDINGS_MAX_PAGES; page++) {
        const { data } = await queryClient<unknown>({
            backend: 'pera',
            service: NFTS_SERVICE,
            scope,
            method: 'GET',
            url,
            params: cursor === null ? undefined : { cursor },
            headers: buildIntegrityHeaders(),
        })
        const { results, next } = nftHoldingsPageSchema.parse(data)
        for (const row of results) {
            const parsed = nftItemSchema.safeParse(row)
            if (parsed.success) {
                items.set(parsed.data.asset_id.toLowerCase(), parsed.data)
            }
        }
        if (next === null) return [...items.values()]
        cursor = next
    }
    throw new Error(
        `Pera NFT holdings for ${scope.chainId}/${scope.networkId} ran past ${NFT_HOLDINGS_MAX_PAGES} pages`,
    )
}

/**
 * Whether `address` holds any NFT the backend lists: one GET of the first
 * page, never a cursor. Rejects with a `PeraNetworkError` on a failed request.
 */
export const fetchHasNftHoldings = async (
    scope: ChainScope,
    chain: EvmChain,
    address: string,
): Promise<boolean> => {
    const { data } = await queryClient<unknown>({
        backend: 'pera',
        service: NFTS_SERVICE,
        scope,
        method: 'GET',
        url: nftHoldingsPath(
            eip155ChainIdOf(scope, chain),
            address.toLowerCase(),
        ),
        headers: buildIntegrityHeaders(),
    })
    const { results, next } = nftHoldingsPageSchema.parse(data)
    return results.length > 0 || next !== null
}

/**
 * One entry per CAIP-19 id, in request order, null where the backend knows
 * none; at most `NFTS_MAX_IDS` ids. Rejects with a `PeraNetworkError` on a
 * failed request.
 */
export const fetchNftItems = async (
    scope: ChainScope,
    chain: EvmChain,
    caip19Ids: string[],
): Promise<Nullable<NftItemSchemaOutput>[]> => {
    if (caip19Ids.length === 0) return []
    eip155ChainIdOf(scope, chain)
    const ids = caip19Ids.map(id => id.toLowerCase())
    const { data } = await queryClient<unknown>({
        backend: 'pera',
        service: NFTS_SERVICE,
        scope,
        method: 'POST',
        url: NFTS_PATH,
        headers: buildIntegrityHeaders(),
        data: { ids },
    })
    const items = nftsResponseSchema.parse(data).results.map(row => {
        const parsed = nftItemSchema.safeParse(row)
        return parsed.success ? parsed.data : null
    })
    // As with fetchAssetItems: position is the only key, so a misaligned
    // answer would store one token's metadata under another's id.
    if (
        items.length !== ids.length ||
        items.some(
            (item, index) =>
                item !== null && item.asset_id.toLowerCase() !== ids[index],
        )
    ) {
        throw new Error(
            `Pera NFTs for ${scope.chainId}/${scope.networkId} answered out of request order`,
        )
    }
    return items
}

/**
 * A period, or a range of whole UTC days (`YYYY-MM-DD`, `to` inclusive) whose
 * buckets sit on whole hours or days. Only range mode lines up with balance
 * history's grid times; period mode buckets from the request's second.
 */
export type ChartQuery =
    | { period: HistoryPeriod }
    | { from: string; to: string; interval: 'hourly' | 'daily' }

/**
 * Oldest first; `[]` for a token the backend has no chart for. Rejects with a
 * `PeraNetworkError` on any other failed request.
 */
export const fetchPriceChart = async (
    scope: ChainScope,
    chain: EvmChain,
    assetId: string,
    query: ChartQuery,
): Promise<PriceHistoryPoint[]> => {
    try {
        const { data } = await queryClient<unknown>({
            backend: 'pera',
            service: PRICES_SERVICE,
            scope,
            method: 'GET',
            url: CHART_PATH,
            params: { id: toCaip19(assetId, scope, chain), ...query },
            headers: buildIntegrityHeaders(),
            timeout: CHART_QUERY_TIMEOUT_MS,
        })
        return chartResponseSchema.parse(data).map(point => ({
            timestamp: Date.parse(point.datetime),
            usdPrice: new Decimal(point.price),
        }))
    } catch (error) {
        if (
            isPeraNetworkError(error) &&
            error.backendCode === 'chart_not_found'
        ) {
            return []
        }
        throw error
    }
}
