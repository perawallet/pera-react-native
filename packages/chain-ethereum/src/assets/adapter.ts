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

import { getAddress, InvalidAddressError, isAddress, zeroAddress } from 'viem'
import {
    assetRefKey,
    type AssetRef,
    type ChainContext,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    getAssetById,
    getStaleOrMissingAssetIds,
    PeraAssetVerificationTier,
    upsertAssets,
    upsertNodeAssets,
    type AssetGroup,
    type AssetsChainAdapter,
    type DisplayableAsset,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    partition,
    PeraServiceUnavailableError,
    type Maybe,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    eip155ChainIdOf,
    InvalidCaip19Error,
    isEvmNftAssetId,
    toCaip19,
    type EvmNftStandard,
} from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import { readErc20, readErc20TotalSupply } from '../blockchain/utils/erc20'
import {
    ASSETS_MAX_IDS,
    ASSETS_SERVICE,
    fetchAssetItems,
    fetchPriceChart,
    fetchNftItems,
    NFTS_SERVICE,
    PRICES_SERVICE,
} from './api/endpoints'
import { cachedWhitelist, type ListedTokens } from './api/whitelist-cache'
import { toAssetMetadata, toNftAsset, toPriceRow } from './api/transformers'
import { NATIVE_ASSET_ID } from '../chains/create-evm-chain'

// Token metadata rarely changes; the same window as Algorand's asset cache.
const ASSET_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

const evmAssetIdOf = (chain: EvmChain, ref: AssetRef): string => {
    if (ref.chainId !== chain.row.id) {
        throw new Error(
            `Not an asset on ${chain.row.displayName}: ${assetRefKey(ref)}`,
        )
    }
    return ref.assetId
}

// The amount conversion reads these, so the contract's answer beats the
// backend's: a wrong backend `decimals` would build a wrong-amount transfer.
const withChainIntrinsics = (
    fromPera: PeraAsset,
    onChain: PeraAsset,
): PeraAsset => ({
    ...fromPera,
    name: onChain.name,
    unitName: onChain.unitName,
    decimals: onChain.decimals,
    totalSupply: onChain.totalSupply,
})

// The backend withholds a quarantined token's metadata, so the chain supplies
// it, but Pera's verdict must survive the chain read's own "unverified".
const asSuspicious = (asset: PeraAsset): PeraAsset => ({
    ...asset,
    peraMetadata: {
        isDeleted: false,
        ...asset.peraMetadata,
        verificationTier: PeraAssetVerificationTier.suspicious,
        // The backend never groups a suspicious token.
        crossChainAssetGroup: null,
    },
})

// The backend rejects the whole batch for an erc20 id at the zero address,
// its native coin's contract.
const isTokenAddress = (address: string): boolean => address !== zeroAddress

// Ids reach the backend and the cache checksummed, whatever case the caller
// used; anything that can't be a token is dropped before any request.
const toTokenIds = (assetIds: string[]): string[] => [
    ...new Set(
        assetIds
            .filter(id => id !== NATIVE_ASSET_ID && isAddress(id))
            .map(id => getAddress(id))
            .filter(isTokenAddress),
    ),
]

const hasServices = (
    ctx: ChainContext,
    scope: ChainScope,
    ...services: string[]
): boolean => {
    const offered = ctx.getPeraBackend(scope).services
    return services.every(service => offered.has(service))
}

// A token whose read fails is left out; its missing row retries it on the
// next pass.
const readOnChain = async (
    ctx: ChainContext,
    chain: EvmChain,
    assetIds: string[],
    scope: ChainScope,
): Promise<PeraAsset[]> => {
    const reads = await Promise.allSettled(
        assetIds.map(id => readErc20(ctx, chain, id, scope)),
    )
    return reads.flatMap(read =>
        read.status === 'fulfilled' ? [read.value] : [],
    )
}

const persistOnChain = async (
    ctx: ChainContext,
    chain: EvmChain,
    assetIds: string[],
    scope: ChainScope,
): Promise<void> => {
    const items = await readOnChain(ctx, chain, assetIds, scope)
    if (items.length > 0) await upsertNodeAssets({ items, scope })
}

// Both halves, so the suspicious tier is persisted, not just the intrinsics.
const persistQuarantined = async (
    ctx: ChainContext,
    chain: EvmChain,
    assetIds: string[],
    scope: ChainScope,
): Promise<void> => {
    const items = (await readOnChain(ctx, chain, assetIds, scope)).map(
        asSuspicious,
    )
    if (items.length > 0) await upsertAssets({ items, scope })
}

// The chain table names the native coin; the backend adds only its cross-chain
// group, so the list can fold it with the same coin on other chains. No user
// flags: the stored favourite and price alert survive the write.
const nativeRow = (chain: EvmChain, group: Maybe<AssetGroup>): PeraAsset => ({
    ...chain.nativeAsset,
    peraMetadata: {
        isDeleted: false,
        verificationTier: PeraAssetVerificationTier.verified,
        crossChainAssetGroup: group,
    },
})

const syncNativeAsset = async (
    ctx: ChainContext,
    chain: EvmChain,
    scope: ChainScope,
): Promise<void> => {
    const hasAssetsService = hasServices(ctx, scope, ASSETS_SERVICE)
    const stale = await getStaleOrMissingAssetIds({
        assetIds: [NATIVE_ASSET_ID],
        scope,
        ttlMs: ASSET_CACHE_TTL_MS,
        recheckUnreadGroup: hasAssetsService,
    })
    if (stale.length === 0) return
    const [item] = hasAssetsService
        ? await fetchAssetItems(scope, chain, [NATIVE_ASSET_ID])
        : []
    await upsertAssets({
        items: [nativeRow(chain, item?.cross_chain_asset_group)],
        scope,
    })
}

const syncTokens = async (
    ctx: ChainContext,
    chain: EvmChain,
    tokenIds: string[],
    scope: ChainScope,
): Promise<void> => {
    if (tokenIds.length === 0) return
    const stale = await getStaleOrMissingAssetIds({
        assetIds: tokenIds,
        scope,
        ttlMs: ASSET_CACHE_TTL_MS,
        recheckUnreadGroup: true,
    })
    if (stale.length === 0) return

    if (!hasServices(ctx, scope, ASSETS_SERVICE)) {
        await persistOnChain(ctx, chain, stale, scope)
        return
    }

    const unknown: string[] = []
    const quarantined: string[] = []
    for (const batch of partition(stale, ASSETS_MAX_IDS)) {
        const items = await fetchAssetItems(scope, chain, batch)
        const known = items.flatMap((item, index) => {
            // Left unstored so the next pass retries it: a chain read would
            // store it without its tier, hiding a suspicious token's warning.
            if (!item) return []
            const { assetId, asset, isQuarantined } = toAssetMetadata(
                batch[index]!,
                item,
            )
            if (asset) return [asset]
            if (isQuarantined) quarantined.push(assetId)
            else unknown.push(assetId)
            return []
        })
        if (known.length > 0) await upsertAssets({ items: known, scope })
    }
    if (unknown.length > 0) await persistOnChain(ctx, chain, unknown, scope)
    if (quarantined.length > 0) {
        await persistQuarantined(ctx, chain, quarantined, scope)
    }
}

const syncAssets =
    (ctx: ChainContext, chain: EvmChain): AssetsChainAdapter['syncAssets'] =>
    async (refs, scope) => {
        eip155ChainIdOf(scope, chain)
        const assetIds = refs.map(ref => evmAssetIdOf(chain, ref))
        await Promise.all([
            assetIds.includes(NATIVE_ASSET_ID)
                ? syncNativeAsset(ctx, chain, scope)
                : undefined,
            syncTokens(ctx, chain, toTokenIds(assetIds), scope),
        ])
    }

const NFT_STANDARDS: readonly EvmNftStandard[] = ['erc721', 'erc1155']

const isNftStandard = (value: unknown): value is EvmNftStandard =>
    NFT_STANDARDS.includes(value as EvmNftStandard)

// The id doesn't carry its standard; the cached row may, and otherwise one
// request asks for both and takes whichever the backend knows.
const fetchNftMetadata = async (
    chain: EvmChain,
    assetId: string,
    scope: ChainScope,
    cached: Nullable<PeraAsset>,
): Promise<Nullable<PeraAsset>> => {
    const standard = cached?.peraMetadata?.collectible?.standard
    const standards = isNftStandard(standard) ? [standard] : NFT_STANDARDS
    const items = await fetchNftItems(
        scope,
        chain,
        standards.map(each => toCaip19(assetId, scope, chain, each)),
    )
    const item = items.find(each => each !== null)
    return item ? toNftAsset(item, scope, chain) : null
}

// Falls back to the stored row, so a backend outage keeps an NFT the account
// already synced on screen.
const getNftMetadata = async (
    ctx: ChainContext,
    chain: EvmChain,
    assetId: string,
    scope: ChainScope,
): Promise<PeraAsset> => {
    const cached = await getAssetById({ assetId, scope })
    if (!hasServices(ctx, scope, NFTS_SERVICE)) {
        if (cached) return cached
        throw new InvalidCaip19Error(assetId, scope)
    }
    let asset: Nullable<PeraAsset>
    try {
        asset = await fetchNftMetadata(chain, assetId, scope, cached)
    } catch (error) {
        if (cached) return cached
        throw error
    }
    if (!asset) {
        if (cached) return cached
        throw new InvalidCaip19Error(assetId, scope)
    }
    // A failed cache write must not fail the read.
    await upsertAssets({ items: [asset], scope }).catch(() => undefined)
    return asset
}

type TokenRead = {
    asset: PeraAsset
    /** Which halves a caller that caches may store. */
    cache: 'both' | 'node' | 'none'
}

// Pera's opinion (tier, quarantine) beside the chain's intrinsics; writes
// nothing, so search can use it too.
const readToken = async (
    ctx: ChainContext,
    chain: EvmChain,
    tokenId: string,
    scope: ChainScope,
): Promise<TokenRead> => {
    const [fromNode, pera] = await Promise.allSettled([
        readErc20(ctx, chain, tokenId, scope),
        hasServices(ctx, scope, ASSETS_SERVICE)
            ? fetchAssetItems(scope, chain, [tokenId])
            : [],
    ])
    const item =
        pera.status === 'fulfilled' && pera.value[0]
            ? toAssetMetadata(tokenId, pera.value[0])
            : undefined
    const fromPera = item?.asset ?? null
    if (fromNode.status === 'rejected') {
        // A quarantined token has no backend record to fall back on.
        if (!fromPera) throw fromNode.reason
        // Unverified decimals: caching them would keep them for the TTL.
        return { asset: fromPera, cache: 'none' }
    }
    if (item?.isQuarantined) {
        // Both halves, as in syncAssets: a node row alone would read as
        // fresh and render without the tier.
        return { asset: asSuspicious(fromNode.value), cache: 'both' }
    }
    return {
        asset: fromPera
            ? withChainIntrinsics(fromPera, fromNode.value)
            : fromNode.value,
        cache: 'node',
    }
}

const getAssetMetadata =
    (
        ctx: ChainContext,
        chain: EvmChain,
    ): AssetsChainAdapter['getAssetMetadata'] =>
    async (ref, scope) => {
        eip155ChainIdOf(scope, chain)
        const assetId = evmAssetIdOf(chain, ref)
        if (assetId === NATIVE_ASSET_ID) return chain.nativeAsset
        if (isEvmNftAssetId(assetId)) {
            return getNftMetadata(ctx, chain, assetId, scope)
        }
        const tokenId = getAddress(assetId)
        if (!isTokenAddress(tokenId)) {
            throw new InvalidAddressError({ address: assetId })
        }
        const { asset, cache } = await readToken(ctx, chain, tokenId, scope)
        // A failed cache write must not fail the read.
        if (cache === 'both') {
            await upsertAssets({ items: [asset], scope }).catch(() => undefined)
        } else if (cache === 'node') {
            await upsertNodeAssets({ items: [asset], scope }).catch(
                () => undefined,
            )
        }
        return asset
    }

// Prices ride on the v4 asset items, so they need the `assets` service as
// well as `prices`; without both every ref is a miss. A row is keyed back to
// the ref it was asked for, whatever case its address came in.
const getPrices =
    (ctx: ChainContext, chain: EvmChain): AssetsChainAdapter['getPrices'] =>
    async (refs, scope) => {
        eip155ChainIdOf(scope, chain)
        for (const ref of refs) evmAssetIdOf(chain, ref)
        if (!hasServices(ctx, scope, ASSETS_SERVICE, PRICES_SERVICE)) return []
        const refById = new Map<string, AssetRef>()
        for (const ref of refs) {
            const id =
                ref.assetId === NATIVE_ASSET_ID
                    ? NATIVE_ASSET_ID
                    : toTokenIds([ref.assetId])[0]
            if (id) refById.set(id, ref)
        }
        const prices = await Promise.all(
            partition([...refById.keys()], ASSETS_MAX_IDS).map(async batch => {
                const items = await fetchAssetItems(scope, chain, batch)
                return items.flatMap((item, index) => {
                    const row = item && toPriceRow(batch[index]!, item)
                    return row
                        ? [
                              {
                                  assetRef: refById.get(row.assetId)!,
                                  usdPrice: row.usdPrice,
                              },
                          ]
                        : []
                })
            }),
        )
        return prices.flat()
    }

const getPriceHistory =
    (
        ctx: ChainContext,
        chain: EvmChain,
    ): NonNullable<AssetsChainAdapter['getPriceHistory']> =>
    async (ref, period, scope) => {
        eip155ChainIdOf(scope, chain)
        const assetId = evmAssetIdOf(chain, ref)
        if (isEvmNftAssetId(assetId)) return []
        if (!hasServices(ctx, scope, PRICES_SERVICE)) return []
        return fetchPriceChart(scope, chain, assetId, { period })
    }

// A contract address matches from its start only: a short query appears
// somewhere in most addresses.
const matchesQuery =
    (needle: string) =>
    (asset: DisplayableAsset): boolean =>
        [asset.name, asset.unitName].some(text =>
            text?.toLowerCase().includes(needle),
        ) ||
        (asset.assetId !== NATIVE_ASSET_ID &&
            asset.assetId.toLowerCase().startsWith(needle))

// A pasted contract address the list doesn't hold is read from the chain, so
// any token can be added, with Pera's tier: pasting is how scam tokens arrive,
// so a quarantined one must reach the warning as suspicious. One that isn't
// an ERC-20 finds nothing.
const unlistedToken = async (
    ctx: ChainContext,
    chain: EvmChain,
    query: string,
    scope: ChainScope,
): Promise<DisplayableAsset[]> => {
    if (!isAddress(query, { strict: false })) return []
    const tokenId = getAddress(query)
    if (!isTokenAddress(tokenId)) return []
    try {
        return [(await readToken(ctx, chain, tokenId, scope)).asset]
    } catch {
        return []
    }
}

// The backend has no EVM token search, so its token list, which holds no
// NFTs, is filtered here in one page.
const search =
    (
        ctx: ChainContext,
        chain: EvmChain,
        listedTokens: ListedTokens,
    ): NonNullable<AssetsChainAdapter['search']> =>
    async ({ query, hasCollectible }, scope) => {
        eip155ChainIdOf(scope, chain)
        if (hasCollectible) return { results: [], nextCursor: undefined }
        // An empty page would read as "No assets found" on a network that
        // can't be searched at all.
        if (!hasServices(ctx, scope, ASSETS_SERVICE)) {
            throw new PeraServiceUnavailableError(scope, ASSETS_SERVICE)
        }
        // The list's native row carries the backend's name for it; every
        // other screen names it from the chain table.
        const assets = (await listedTokens(scope)).map(({ asset }) =>
            asset.assetId === NATIVE_ASSET_ID
                ? {
                      ...asset,
                      name: chain.nativeAsset.name,
                      unitName: chain.nativeAsset.unitName,
                  }
                : asset,
        )
        const trimmed = query.trim()
        const needle = trimmed.toLowerCase()
        if (!needle) return { results: assets, nextCursor: undefined }
        const matches = assets.filter(matchesQuery(needle))
        return {
            results:
                matches.length > 0
                    ? matches
                    : await unlistedToken(ctx, chain, trimmed, scope),
            nextCursor: undefined,
        }
    }

/** `listedTokens` is the chain's token list, shared with its accounts adapter. */
export const createEthereumAssetsAdapter = (
    ctx: ChainContext,
    chain: EvmChain,
    listedTokens: ListedTokens = cachedWhitelist(chain),
): AssetsChainAdapter => {
    return {
        chainId: chain.row.id,
        priceProvider: 'pera',
        maxPriceIdsPerRequest: ASSETS_MAX_IDS,
        getNativeAsset: () => chain.nativeAsset,
        syncAssets: syncAssets(ctx, chain),
        getAssetMetadata: getAssetMetadata(ctx, chain),
        fetchOnChainAsset: async (ref, scope) => {
            eip155ChainIdOf(scope, chain)
            const assetId = evmAssetIdOf(chain, ref)
            if (assetId === NATIVE_ASSET_ID) return chain.nativeAsset
            // An NFT has no ERC-20 surface to read.
            if (isEvmNftAssetId(assetId)) {
                throw new InvalidAddressError({ address: assetId })
            }
            return readErc20(ctx, chain, assetId, scope)
        },
        fetchOnChainTotalSupply: async (ref, scope) => {
            eip155ChainIdOf(scope, chain)
            const assetId = evmAssetIdOf(chain, ref)
            if (assetId === NATIVE_ASSET_ID)
                return chain.nativeAsset.totalSupply
            if (isEvmNftAssetId(assetId)) {
                throw new InvalidAddressError({ address: assetId })
            }
            return readErc20TotalSupply(ctx, chain, assetId, scope)
        },
        search: search(ctx, chain, listedTokens),
        getPrices: getPrices(ctx, chain),
        getPriceHistory: getPriceHistory(ctx, chain),
    }
}
