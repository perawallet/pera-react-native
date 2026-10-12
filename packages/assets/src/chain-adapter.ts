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
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    isAlgoAssetName,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { DisplayableAsset, PeraAsset } from './models'

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
    /** Fetches whatever is stale or missing for `assetIds` and persists it. */
    syncAssets(assetIds: string[], scope: ChainScope): Promise<void>
    /** Merged read of every per-asset source; persists the chain-intrinsic half. */
    fetchAsset(assetId: string, scope: ChainScope): Promise<PeraAsset>
    /** The chain's own record of the asset, with no third-party opinion merged in. */
    fetchOnChainAsset(assetId: string, scope: ChainScope): Promise<PeraAsset>
    fetchAssetAuthorities(
        assetId: string,
        scope: ChainScope,
    ): Promise<AssetAuthorities>
    searchAssets(
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
}

export const assetsChainAdapters =
    createChainAdapterRegistry<AssetsChainAdapter>('assets')

export const assetsAdapterFor = (scope: ChainScope): AssetsChainAdapter =>
    assetsChainAdapters.get(scope.chainId)

/** @throws ChainAdapterNotRegisteredError */
export const nativeAssetFor = (chainId: ChainId): PeraAsset =>
    assetsChainAdapters.get(chainId).getNativeAsset()

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

// The wrappers below are async so a missing adapter rejects instead of
// throwing synchronously past a caller's `.catch`.
export const fetchAndPersistAssets = async (
    assetIds: string[],
    scope: ChainScope,
): Promise<void> => {
    await assetsAdapterFor(scope).syncAssets(assetIds, scope)
}

export const fetchOnChainAsset = async (
    assetId: string,
    scope: ChainScope,
): Promise<PeraAsset> =>
    assetsAdapterFor(scope).fetchOnChainAsset(assetId, scope)
