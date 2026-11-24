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
import { buildIntegrityHeadersWhenReady } from '@perawallet/wallet-core-app-integrity'
import { Decimal } from 'decimal.js'
import type { PriceHistoryPoint } from '@perawallet/wallet-core-assets'
import {
    CHART_QUERY_TIMEOUT_MS,
    isPeraNetworkError,
    PeraServiceUnavailableError,
    queryClient,
    type HistoryPeriod,
    type Nullable,
    type Optional,
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
    tokenSearchPageSchema,
    whitelistResponseSchema,
    type AssetItemSchemaOutput,
    type NftItemSchemaOutput,
} from './schema'
import { toWhitelistRow, type WhitelistRow } from './transformers'

export const ASSETS_SERVICE = 'assets'
export const PRICES_SERVICE = 'prices'
export const NFTS_SERVICE = 'nfts'
export const TOKEN_SEARCH_SERVICE = 'tokenSearch'

export const ASSETS_PATH = '/api/v4/assets/'
// The backend rejects a request naming more ids than this (422).
export const ASSETS_MAX_IDS = 500

export const whitelistPath = (eip155ChainId: number | string): string =>
    `/api/v3/evm/${eip155ChainId}/tokens/`

export const CHART_PATH = '/api/v4/assets/chart/'

export const TOKEN_SEARCH_PATH = '/api/v4/assets/search/'

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
 * The cursor a holdings page's `next` URL carries. Throws on anything else, so a
 * malformed page fails the read instead of looping.
 */
export const nftCursorOf = (next: string): string => {
    const cursor = new URL(next).searchParams.get('cursor')
    if (cursor === null || cursor === '') {
        throw new Error('Pera NFT holdings page named no cursor in `next`')
    }
    return cursor
}

/** A chain the backend runs no NFT reads for answers 422 `nft_not_supported`. */
export const isNftNotSupportedError = (error: unknown): boolean =>
    isPeraNetworkError(error) &&
    error.status === 422 &&
    error.backendCode === 'nft_not_supported'

/**
 * One entry per id, in request order, null where the row is one this client
 * can't read; at most `ASSETS_MAX_IDS` ids. Rejects with a `PeraNetworkError`
 * on a failed request.
 */
export const fetchAssetItems = async (
    scope: ChainScope,
    chain: EvmChain,
    assetIds: string[],
    signal?: AbortSignal,
): Promise<Nullable<AssetItemSchemaOutput>[]> => {
    if (assetIds.length === 0) return []
    const ids = assetIds.map(id => toCaip19(id, scope, chain))
    const { data } = await queryClient<unknown>({
        backend: 'pera',
        service: ASSETS_SERVICE,
        scope,
        method: 'POST',
        url: ASSETS_PATH,
        headers: await buildIntegrityHeadersWhenReady(),
        data: { ids },
        signal,
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

export type TokenSearchPage = {
    items: AssetItemSchemaOutput[]
    nextCursor: Optional<string>
}

/**
 * One page of the backend's token search on the scope's chain; an item this
 * client can't read is skipped. Every page repeats `query`, which the cursor
 * is bound to. Rejects with a `PeraNetworkError` on a failed request,
 * including 422 `search_cursor_expired` once the search is 5 minutes old.
 */
export const fetchTokenSearchPage = async (
    scope: ChainScope,
    chain: EvmChain,
    query: string,
    cursor?: string,
): Promise<TokenSearchPage> => {
    const { data } = await queryClient<unknown>({
        backend: 'pera',
        service: TOKEN_SEARCH_SERVICE,
        scope,
        method: 'GET',
        url: TOKEN_SEARCH_PATH,
        params: {
            q: query,
            chains: `eip155:${eip155ChainIdOf(scope, chain)}`,
            ...(cursor === undefined ? {} : { cursor }),
        },
        headers: await buildIntegrityHeadersWhenReady(),
    })
    const { results, next } = tokenSearchPageSchema.parse(data)
    return {
        items: results.flatMap(row => {
            const parsed = assetItemSchema.safeParse(row)
            return parsed.success ? [parsed.data] : []
        }),
        nextCursor: next ?? undefined,
    }
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
        headers: await buildIntegrityHeadersWhenReady(),
    })
    const { results } = whitelistResponseSchema.parse(data)
    return results.flatMap(row => toWhitelistRow(row, scope, chain) ?? [])
}

export type NftHoldingsListing = {
    /** Page one as the backend answered it. */
    pageOne: string
    items: NftItemSchemaOutput[]
    /** Epoch ms of the full read the items came from. */
    readAt: number
}

export type NftHoldingsOptions = {
    forceRefresh?: boolean
    prior?: NftHoldingsListing
    now?: () => number
}

/**
 * How long `prior` may stand in for a full read: one backend rate-limit
 * window. An NFT received past page one leaves page one as it was, so this
 * bounds how long it stays unlisted.
 */
export const NFT_LISTING_REUSE_MS = 10 * 60_000

/**
 * Every NFT `address` holds on the scope's chain, across all pages; a row
 * this client can't read is skipped. `prior` is answered again, with no cursor
 * page read, when page one is unchanged and `prior` is younger than
 * `NFT_LISTING_REUSE_MS`; `forceRefresh` skips the backend's
 * page-one cache and `prior`, for a refresh the user asked for. Rejects on a
 * failed page, so a partial list never stands in for the whole: with a
 * `PeraServiceUnavailableError` when the chain has no NFT reads, and a plain
 * `Error` on a malformed `next`.
 */
export const fetchNftHoldings = async (
    scope: ChainScope,
    chain: EvmChain,
    address: string,
    { forceRefresh = false, prior, now = Date.now }: NftHoldingsOptions = {},
): Promise<NftHoldingsListing> => {
    const readAt = now()
    const reusable =
        !forceRefresh &&
        prior !== undefined &&
        readAt - prior.readAt < NFT_LISTING_REUSE_MS
    const url = nftHoldingsPath(
        eip155ChainIdOf(scope, chain),
        address.toLowerCase(),
    )
    const items = new Map<string, NftItemSchemaOutput>()
    let params: Optional<Record<string, string>> = forceRefresh
        ? { force_refresh: 'true' }
        : undefined
    let pageOne = ''
    for (let page = 0; page < NFT_HOLDINGS_MAX_PAGES; page++) {
        const { data } = await queryClient<unknown>({
            backend: 'pera',
            service: NFTS_SERVICE,
            scope,
            method: 'GET',
            url,
            params,
            headers: await buildIntegrityHeadersWhenReady(),
        }).catch((error: unknown) => {
            // The chain has no NFT reads: the same as a scope without the
            // service, so the syncer keeps stored rows instead of flagging.
            if (isNftNotSupportedError(error)) {
                throw new PeraServiceUnavailableError(scope, NFTS_SERVICE)
            }
            throw error
        })
        const { results, next } = nftHoldingsPageSchema.parse(data)
        if (page === 0) {
            pageOne = JSON.stringify(data)
            // The backend drops its cached page one on a transfer, while every
            // cursor page is uncached and counts against the device's limit.
            if (reusable && prior.pageOne === pageOne) return prior
        }
        for (const row of results) {
            const parsed = nftItemSchema.safeParse(row)
            if (parsed.success) {
                items.set(parsed.data.asset_id.toLowerCase(), parsed.data)
            }
        }
        if (next === null) {
            return { pageOne, items: [...items.values()], readAt }
        }
        params = { cursor: nftCursorOf(next) }
    }
    throw new Error(
        `Pera NFT holdings for ${scope.chainId}/${scope.networkId} ran past ${NFT_HOLDINGS_MAX_PAGES} pages`,
    )
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
        headers: await buildIntegrityHeadersWhenReady(),
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
 * Oldest first; `null` for a token the backend has no chart for, while `[]` is a
 * charted token with no stored price inside the window. Rejects with a
 * `PeraNetworkError` on any other failed request.
 */
export const fetchPriceChartOrNotFound = async (
    scope: ChainScope,
    chain: EvmChain,
    assetId: string,
    query: ChartQuery,
    signal?: AbortSignal,
): Promise<Nullable<PriceHistoryPoint[]>> => {
    try {
        const { data } = await queryClient<unknown>({
            backend: 'pera',
            service: PRICES_SERVICE,
            scope,
            method: 'GET',
            url: CHART_PATH,
            params: { id: toCaip19(assetId, scope, chain), ...query },
            headers: await buildIntegrityHeadersWhenReady(),
            signal,
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
            return null
        }
        throw error
    }
}

/** Oldest first; `[]` for a token the backend has no chart for. */
export const fetchPriceChart = async (
    scope: ChainScope,
    chain: EvmChain,
    assetId: string,
    query: ChartQuery,
    signal?: AbortSignal,
): Promise<PriceHistoryPoint[]> =>
    (await fetchPriceChartOrNotFound(scope, chain, assetId, query, signal)) ??
    []
