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

import {
    createChainAdapterRegistry,
    type AssetPrice,
    type AssetRef,
    type ChainAssetData,
    type ChainId,
    type ChainScope,
    toScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import {
    AppError,
    ErrorCategory,
    isAlgoAssetName,
    isChainRefusedError,
    isPeraServiceUnavailableError,
    type HistoryPeriod,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { Decimal } from 'decimal.js'
import type { DisplayableAsset, PeraAsset } from './models'
import { useAssetSearchAvailabilityStore } from './store/search-availability-store'

export type AssetAuthorities = {
    hasFreeze: boolean
    hasClawback: boolean
    freezeAddress: Nullable<string>
    clawbackAddress: Nullable<string>
}

export type AssetSearchParams = {
    query: string
    cursor?: string
    hasCollectible?: boolean
}

export type AssetSearchPage = {
    results: DisplayableAsset[]
    nextCursor: Optional<string>
}

/** How a chain keeps its own asset data on the cached asset row. */
export interface AssetChainDataCodec {
    /** Null when the asset carries nothing the chain keeps. */
    encode(asset: PeraAsset): Nullable<ChainAssetData>
    decode(data: ChainAssetData): Pick<PeraAsset, 'creator'>
}

/** One point of an asset's price over time. */
export type PriceHistoryPoint = {
    /** Unix ms. */
    timestamp: number
    /** USD per whole unit. */
    usdPrice: Decimal
}

/**
 * Where a chain's prices come from. A chain adds its member in the change that
 * adds the provider, like `ChainId`.
 */
export type PriceProvider = 'pera'

/** The chain-specific asset and price sources; registered by the chain package. */
export interface AssetsChainAdapter {
    chainId: ChainId
    /** The source `getPrices` reads. */
    priceProvider: PriceProvider
    /** Most refs one `getPrices` call may carry. */
    maxPriceIdsPerRequest: number
    /**
     * The chain's native asset. Must be the same instance on every call:
     * memoised consumers compare it by identity. Seeded, never fetched.
     */
    getNativeAsset(): PeraAsset
    /**
     * Fetches whatever is stale or missing for `refs` and persists it. Accepts
     * the native ref and skips it. Rejects a ref or a scope on another chain.
     */
    syncAssets(refs: AssetRef[], scope: ChainScope): Promise<void>
    /**
     * The asset as the chain's sources for `scope` describe it, with any
     * third-party opinion (verification tier, logo) merged in. Persists the
     * chain-intrinsic half. The native ref resolves to `getNativeAsset()`
     * without a request. Rejects a ref or a scope on another chain.
     */
    getAssetMetadata(ref: AssetRef, scope: ChainScope): Promise<PeraAsset>
    /**
     * The chain's own record of the asset, with no third-party opinion merged
     * in. Rejects a ref or a scope on another chain.
     */
    fetchOnChainAsset(ref: AssetRef, scope: ChainScope): Promise<PeraAsset>
    /**
     * Absent on a chain whose tokens carry no freeze or clawback authority.
     * Rejects a ref or a scope on another chain.
     */
    fetchAssetAuthorities?(
        ref: AssetRef,
        scope: ChainScope,
    ): Promise<AssetAuthorities>
    /**
     * One page of assets matching `params.query`. Absent on a chain with no
     * asset search, whose `assetSearch` capability stays off. Rejects a scope
     * on another chain.
     */
    search?(
        params: AssetSearchParams,
        scope: ChainScope,
    ): Promise<AssetSearchPage>
    /**
     * USD per whole unit for each ref the source has a price for, keyed by the
     * requested ref. A ref with no known price is left out, never priced 0, so
     * the caller can record the miss under `scope`. Resolves `[]` for no refs;
     * rejects a ref or a scope on another chain.
     */
    getPrices(refs: AssetRef[], scope: ChainScope): Promise<AssetPrice[]>
    /**
     * USD per whole unit over `period`, oldest first; `[]` when the source has
     * no chart for the asset. Absent on a chain with no price history, whose
     * `priceHistory` capability stays off. Rejects a ref or a scope on another
     * chain.
     */
    getPriceHistory?(
        ref: AssetRef,
        period: HistoryPeriod,
        scope: ChainScope,
    ): Promise<PriceHistoryPoint[]>
    /** Absent on a chain that keeps no asset data of its own. */
    chainData?: AssetChainDataCodec
}

export const assetsChainAdapters =
    createChainAdapterRegistry<AssetsChainAdapter>('assets')

export const assetsAdapterFor = (scope: ChainScope): AssetsChainAdapter =>
    assetsChainAdapters.get(scope.chainId)

/** @throws ChainAdapterNotRegisteredError */
export const nativeAssetFor = (chainId: ChainId): PeraAsset =>
    assetsChainAdapters.get(chainId).getNativeAsset()

/** {@link nativeAssetFor}, or undefined when this build doesn't ship the chain's assets adapter. */
export const findNativeAsset = (chainId: ChainId): PeraAsset | undefined =>
    assetsChainAdapters.has(chainId) ? nativeAssetFor(chainId) : undefined

/** @throws ChainAdapterNotRegisteredError */
export const isNativeAssetId = (chainId: ChainId, assetId: string): boolean =>
    nativeAssetFor(chainId).assetId === assetId

/**
 * Asset id for a *trusted* display-currency code (a settings/backend value,
 * never an on-chain unit name): the native id when the code is the ALGO ticker,
 * else null (a fiat code). Bridges name-keyed trusted sources into the
 * id-keyed identity that amount renderers require.
 *
 * @throws ChainAdapterNotRegisteredError
 */
export const displayCurrencyToAssetId = (
    code: string,
    chainId: ChainId,
): Nullable<string> =>
    isAlgoAssetName(code) ? nativeAssetFor(chainId).assetId : null

const chainDataCodecFor = (chainId: ChainId): Optional<AssetChainDataCodec> =>
    assetsChainAdapters.has(chainId)
        ? assetsChainAdapters.get(chainId).chainData
        : undefined

/** Null when the chain's adapter isn't registered or declares no codec. */
export const encodeAssetChainData = (
    chainId: ChainId,
    asset: PeraAsset,
): Nullable<ChainAssetData> => chainDataCodecFor(chainId)?.encode(asset) ?? null

// Never throws: holdings reads run this for every rendered row.
export const decodeAssetChainData = (
    chainId: ChainId,
    data: Nullable<ChainAssetData>,
): Pick<PeraAsset, 'creator'> => {
    const codec = chainDataCodecFor(chainId)
    return data && codec ? codec.decode(data) : { creator: { address: '' } }
}

export class AssetSearchUnsupportedError extends AppError {
    readonly chainId: ChainId

    constructor(chainId: ChainId) {
        super(`Asset search is not supported on ${chainId}.`, {
            category: ErrorCategory.ASSETS,
            recoverable: false,
        })
        this.name = 'AssetSearchUnsupportedError'
        this.chainId = chainId
    }
}

/**
 * The scope can't be searched here, so the failure says nothing about what
 * exists: the chain has no search, its network has no Pera services, or the
 * backend hasn't switched the chain on. {@link searchAssetsAcrossScopes}
 * remembers it until relaunch, so the scope isn't asked again.
 */
export const isAssetSearchUnavailableError = (error: unknown): error is Error =>
    error instanceof AssetSearchUnsupportedError ||
    isPeraServiceUnavailableError(error) ||
    isChainRefusedError(error)

export class AssetPriceHistoryUnsupportedError extends AppError {
    readonly chainId: ChainId

    constructor(chainId: ChainId) {
        super(`Price history is not supported on ${chainId}.`, {
            category: ErrorCategory.ASSETS,
            recoverable: false,
        })
        this.name = 'AssetPriceHistoryUnsupportedError'
        this.chainId = chainId
    }
}

const NO_ASSET_AUTHORITIES: AssetAuthorities = {
    hasFreeze: false,
    hasClawback: false,
    freezeAddress: null,
    clawbackAddress: null,
}

const assetRefOn = (scope: ChainScope, assetId: string): AssetRef => ({
    chainId: scope.chainId,
    assetId,
})

// The wrappers below are async so a missing adapter rejects instead of
// throwing synchronously past a caller's `.catch`.
export const fetchAndPersistAssets = async (
    assetIds: string[],
    scope: ChainScope,
): Promise<void> => {
    await assetsAdapterFor(scope).syncAssets(
        assetIds.map(id => assetRefOn(scope, id)),
        scope,
    )
}

export const fetchAssetMetadata = async (
    assetId: string,
    scope: ChainScope,
): Promise<PeraAsset> =>
    assetsAdapterFor(scope).getAssetMetadata(assetRefOn(scope, assetId), scope)

export const fetchOnChainAsset = async (
    assetId: string,
    scope: ChainScope,
): Promise<PeraAsset> =>
    assetsAdapterFor(scope).fetchOnChainAsset(assetRefOn(scope, assetId), scope)

/** No authority, without a request, on a chain that declares no `fetchAssetAuthorities`. */
export const fetchAssetAuthorities = async (
    assetId: string,
    scope: ChainScope,
): Promise<AssetAuthorities> => {
    const adapter = assetsAdapterFor(scope)
    return adapter.fetchAssetAuthorities
        ? adapter.fetchAssetAuthorities(assetRefOn(scope, assetId), scope)
        : NO_ASSET_AUTHORITIES
}

/** Rejects with {@link AssetSearchUnsupportedError} on a chain that declares no `search`. */
export const searchAssets = async (
    params: AssetSearchParams,
    scope: ChainScope,
): Promise<AssetSearchPage> => {
    const adapter = assetsAdapterFor(scope)
    if (!adapter.search) throw new AssetSearchUnsupportedError(adapter.chainId)
    return adapter.search(params, scope)
}

export type ScopedAssetSearchResult = {
    scope: ChainScope
    asset: DisplayableAsset
}

/** One per searched scope, in its order: that scope's next cursor, or null once it has no more. */
export type ScopedAssetSearchCursors = readonly Nullable<string>[]

export type ScopedAssetSearchParams = Omit<AssetSearchParams, 'cursor'> & {
    /** Absent for the first page, which searches every scope from its start. */
    cursors?: ScopedAssetSearchCursors
}

export type ScopedAssetSearchPage = {
    results: ScopedAssetSearchResult[]
    /** Undefined once no scope has more. */
    nextCursors: Optional<ScopedAssetSearchCursors>
    /** Scopes whose search failed on this page, so their hits are missing. */
    failedScopes: ChainScope[]
}

/**
 * One page from each scope that still has more, concatenated in `scopes`
 * order. A scope whose search fails stops being searched while the others'
 * hits still show, and is named in `failedScopes`; a page with no hits
 * rejects with the first failure, so a failed search never reads as an empty
 * one. A scope that can't be searched here
 * ({@link isAssetSearchUnavailableError}) has nothing to find: it isn't named,
 * and decides only a page no scope answered.
 */
export const searchAssetsAcrossScopes = async (
    { cursors, ...params }: ScopedAssetSearchParams,
    scopes: readonly ChainScope[],
): Promise<ScopedAssetSearchPage> => {
    const { unavailableSearches, markSearchUnavailable } =
        useAssetSearchAvailabilityStore.getState()
    const searched = scopes.flatMap((scope, index) => {
        const cursor = cursors ? cursors[index] : undefined
        if (cursor === null) return []
        const remembered = unavailableSearches[toScopeKey(scope)]
        return [
            {
                index,
                scope,
                page:
                    remembered === undefined
                        ? searchAssets({ ...params, cursor }, scope)
                        : Promise.reject(remembered),
            },
        ]
    })
    const settled = await Promise.allSettled(searched.map(({ page }) => page))
    settled.forEach((outcome, position) => {
        if (
            outcome.status === 'rejected' &&
            isAssetSearchUnavailableError(outcome.reason)
        ) {
            markSearchUnavailable(searched[position]!.scope, outcome.reason)
        }
    })

    const nextCursors: Nullable<string>[] = scopes.map(() => null)
    const results = searched.flatMap(({ index, scope }, position) => {
        const outcome = settled[position]!
        if (outcome.status === 'rejected') return []
        nextCursors[index] = outcome.value.nextCursor ?? null
        return outcome.value.results.map(asset => ({ scope, asset }))
    })
    const rejections = settled.filter(
        (outcome): outcome is PromiseRejectedResult =>
            outcome.status === 'rejected',
    )
    const hasAnswer = rejections.length < settled.length
    const failure =
        rejections.find(
            ({ reason }) => !isAssetSearchUnavailableError(reason),
        ) ?? (hasAnswer ? undefined : rejections[0])
    if (results.length === 0 && failure) throw failure.reason
    return {
        results,
        nextCursors: nextCursors.some(cursor => cursor !== null)
            ? nextCursors
            : undefined,
        failedScopes: searched.flatMap(({ scope }, position) => {
            const outcome = settled[position]!
            return outcome.status === 'rejected' &&
                !isAssetSearchUnavailableError(outcome.reason)
                ? [scope]
                : []
        }),
    }
}

/** Rejects with {@link AssetPriceHistoryUnsupportedError} on a chain that declares no `getPriceHistory`. */
export const fetchAssetPriceHistory = async (
    assetId: string,
    period: HistoryPeriod,
    scope: ChainScope,
): Promise<PriceHistoryPoint[]> => {
    const adapter = assetsAdapterFor(scope)
    if (!adapter.getPriceHistory) {
        throw new AssetPriceHistoryUnsupportedError(adapter.chainId)
    }
    return adapter.getPriceHistory(assetRefOn(scope, assetId), period, scope)
}
