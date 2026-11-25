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
    getAssetsByIds,
    getStaleOrMissingAssetIds,
    PeraAssetVerificationTier,
    upsertAssets,
    upsertNodeAssets,
    upsertPeraAssets,
    type AssetGroup,
    type AssetSearchPage,
    type AssetsChainAdapter,
    type DisplayableAsset,
    type PeraAsset,
    type SyncAssetsOptions,
} from '@perawallet/wallet-core-assets'
import {
    isChainRefusedError,
    logger,
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
import {
    readErc20,
    readErc20Decimals,
    readErc20TotalSupply,
} from '../blockchain/utils/erc20'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import {
    ASSETS_MAX_IDS,
    ASSETS_SERVICE,
    fetchAssetItems,
    fetchPriceChart,
    fetchNftItems,
    NFTS_SERVICE,
    PRICES_SERVICE,
    TOKEN_SEARCH_SERVICE,
    fetchTokenSearchPage,
} from './api/endpoints'
import { cachedWhitelist, type ListedTokens } from './api/whitelist-cache'
import { spamCheckFor, type SpamCheck } from './spam-names'
import {
    isDescribedNftItem,
    toAssetMetadata,
    toNftAsset,
    toPriceRow,
    toSearchResult,
} from './api/transformers'
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

const asUnflagged = (asset: PeraAsset): PeraAsset => ({
    ...asset,
    peraMetadata: {
        isDeleted: false,
        ...asset.peraMetadata,
        verificationTier: PeraAssetVerificationTier.unverified,
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

const spamCheck = (
    chain: EvmChain,
    listedTokens: ListedTokens,
    scope: ChainScope,
): SpamCheck =>
    spamCheckFor(listedTokens, chain.nativeAsset.unitName ?? '', scope)

const flagSpam = async (
    assets: PeraAsset[],
    isSpam: SpamCheck,
    hasBackendRecord: boolean,
): Promise<PeraAsset[]> =>
    Promise.all(
        assets.map(async asset =>
            (await isSpam(asset, hasBackendRecord))
                ? asSuspicious(asset)
                : asset,
        ),
    )

const isFlagged = (asset: PeraAsset): boolean =>
    asset.peraMetadata?.verificationTier ===
    PeraAssetVerificationTier.suspicious

// After the backend's "no record" (`hasBackendAnswered`), a stored suspicious
// tier can only be an old name flag; otherwise it may be the backend's verdict.
const persistOnChain = async (
    ctx: ChainContext,
    chain: EvmChain,
    assetIds: string[],
    scope: ChainScope,
    isSpam: SpamCheck,
    hasBackendAnswered: boolean,
): Promise<void> => {
    const items = await flagSpam(
        await readOnChain(ctx, chain, assetIds, scope),
        isSpam,
        false,
    )
    const plain = items.filter(asset => !isFlagged(asset))
    const wasFlagged = new Set(
        hasBackendAnswered
            ? (
                  await getAssetsByIds({
                      assetIds: plain.map(asset => asset.assetId),
                      scope,
                  })
              )
                  .filter(isFlagged)
                  .map(asset => asset.assetId)
            : [],
    )
    const full = items.flatMap(asset => {
        if (isFlagged(asset)) return [asset]
        return wasFlagged.has(asset.assetId) ? [asUnflagged(asset)] : []
    })
    const nodeOnly = plain.filter(asset => !wasFlagged.has(asset.assetId))
    if (full.length > 0) await upsertAssets({ items: full, scope })
    if (nodeOnly.length > 0) await upsertNodeAssets({ items: nodeOnly, scope })
}

// A token cached before its name was checked stays fresh for the TTL; its
// stored name is enough to flag it now, without a request. Whether the backend
// knew it isn't stored, so the symbol rule waits for the token's next sync.
const reflagStored = async (
    tokenIds: string[],
    scope: ChainScope,
    isSpam: SpamCheck,
): Promise<void> => {
    if (tokenIds.length === 0) return
    const stored = await getAssetsByIds({
        assetIds: tokenIds,
        scope,
        isUnvettedOnly: true,
    })
    const items = (await flagSpam(stored, isSpam, true)).filter(isFlagged)
    // Pera's half alone, so the chain half keeps its own freshness.
    if (items.length > 0) await upsertPeraAssets({ items, scope })
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
    // Best-effort: the row is ours, only the group is the backend's. An absent
    // group keeps a stored one, or leaves the row for the unread-group recheck.
    const [item] = hasAssetsService
        ? await fetchAssetItems(scope, chain, [NATIVE_ASSET_ID]).catch(
              (error: unknown) => {
                  const message =
                      'Native coin group unreadable; storing without it'
                  if (isChainRefusedError(error)) {
                      logger.debug(message, { scope, error })
                  } else {
                      logger.warn(message, { scope, error })
                  }
                  return []
              },
          )
        : []
    await upsertAssets({
        items: [nativeRow(chain, item?.cross_chain_asset_group)],
        scope,
    })
}

const persistWithChainDecimals = async (
    ctx: ChainContext,
    chain: EvmChain,
    assets: PeraAsset[],
    scope: ChainScope,
): Promise<void> => {
    if (assets.length === 0) return
    let decimals: Map<string, number>
    try {
        decimals = await readErc20Decimals(
            createEvmClient(scope, ctx, chain),
            assets.map(asset => asset.assetId),
        )
    } catch (error) {
        logger.warn(
            'Token decimals unreadable; leaving them for the next pass',
            { scope, error },
        )
        return
    }
    const items = assets.flatMap(asset => {
        const value = decimals.get(asset.assetId)
        return value === undefined ? [] : [{ ...asset, decimals: value }]
    })
    if (items.length > 0) await upsertAssets({ items, scope })
}

const syncTokens = async (
    ctx: ChainContext,
    chain: EvmChain,
    tokenIds: string[],
    scope: ChainScope,
    isSpam: SpamCheck,
    { isOnDemand = false }: SyncAssetsOptions = {},
): Promise<void> => {
    if (tokenIds.length === 0) return
    const stale = await getStaleOrMissingAssetIds({
        assetIds: tokenIds,
        scope,
        ttlMs: ASSET_CACHE_TTL_MS,
        recheckUnreadGroup: true,
        // Without the backend the recheck could only read the chain again.
        recheckBackendless:
            isOnDemand && hasServices(ctx, scope, ASSETS_SERVICE),
        // A verified token the backend still lacks a logo for shouldn't wait
        // out the metadata TTL once the backend adds one.
        recheckMissingLogo: true,
    })
    await reflagStored(
        tokenIds.filter(id => !stale.includes(id)),
        scope,
        isSpam,
    )
    if (stale.length === 0) return

    if (!hasServices(ctx, scope, ASSETS_SERVICE)) {
        await persistOnChain(ctx, chain, stale, scope, isSpam, false)
        return
    }

    const unknown: string[] = []
    const quarantined: string[] = []
    // Stored in one decimals read after every batch, so a failed batch fails the
    // pass whole and its ids retry next time.
    const known: PeraAsset[] = []
    for (const batch of partition(stale, ASSETS_MAX_IDS)) {
        const items = await fetchAssetItems(scope, chain, batch)
        const batchKnown = items.flatMap((item, index) => {
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
        known.push(...batchKnown)
    }
    await persistWithChainDecimals(
        ctx,
        chain,
        await flagSpam(known, isSpam, true),
        scope,
    )
    if (unknown.length > 0) {
        await persistOnChain(ctx, chain, unknown, scope, isSpam, true)
    }
    if (quarantined.length > 0) {
        await persistQuarantined(ctx, chain, quarantined, scope)
    }
}

const syncAssets =
    (
        ctx: ChainContext,
        chain: EvmChain,
        listedTokens: ListedTokens,
    ): AssetsChainAdapter['syncAssets'] =>
    async (refs, scope, options) => {
        eip155ChainIdOf(scope, chain)
        const assetIds = refs.map(ref => evmAssetIdOf(chain, ref))
        await Promise.all([
            assetIds.includes(NATIVE_ASSET_ID)
                ? syncNativeAsset(ctx, chain, scope)
                : undefined,
            syncTokens(
                ctx,
                chain,
                toTokenIds(assetIds),
                scope,
                spamCheck(chain, listedTokens, scope),
                options,
            ),
        ])
    }

const NFT_STANDARDS: readonly EvmNftStandard[] = ['erc721', 'erc1155']

const isNftStandard = (value: unknown): value is EvmNftStandard =>
    NFT_STANDARDS.includes(value as EvmNftStandard)

// The id doesn't carry its standard; the cached row may, and otherwise one
// request asks for both. The backend answers a blank item for a token it
// doesn't know under that standard, so only a described item counts.
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
    const item = items.find(each => each !== null && isDescribedNftItem(each))
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
    /** False only on a blank item or no assets service, as syncTokens reads "no record"; a failed request or an unreadable row isn't one. */
    hasBackendRecord: boolean
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
    const hasNoRecord =
        pera.status === 'fulfilled' &&
        (pera.value.length === 0 ||
            (!!item && !fromPera && !item.isQuarantined))
    const hasBackendRecord = !hasNoRecord
    if (fromNode.status === 'rejected') {
        // A quarantined token has no backend record to fall back on.
        if (!fromPera) throw fromNode.reason
        // Unverified decimals: caching them would keep them for the TTL.
        return { asset: fromPera, cache: 'none', hasBackendRecord }
    }
    if (item?.isQuarantined) {
        // Both halves, as in syncAssets: a node row alone would read as
        // fresh and render without the tier.
        return {
            asset: asSuspicious(fromNode.value),
            cache: 'both',
            hasBackendRecord,
        }
    }
    return {
        asset: fromPera
            ? withChainIntrinsics(fromPera, fromNode.value)
            : fromNode.value,
        // Without Pera's half the row reads as fresh for the TTL, so the
        // token's logo and tier would stay out of the store.
        cache: fromPera ? 'both' : 'node',
        hasBackendRecord,
    }
}

// Even a token the chain answers alone: its name is all the check needs.
const readCheckedToken = async (
    ctx: ChainContext,
    chain: EvmChain,
    tokenId: string,
    scope: ChainScope,
    isSpam: SpamCheck,
): Promise<TokenRead> => {
    const read = await readToken(ctx, chain, tokenId, scope)
    if (!(await isSpam(read.asset, read.hasBackendRecord))) return read
    return {
        ...read,
        asset: asSuspicious(read.asset),
        cache: read.cache === 'none' ? 'none' : 'both',
    }
}

const getAssetMetadata =
    (
        ctx: ChainContext,
        chain: EvmChain,
        listedTokens: ListedTokens,
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
        const { asset, cache } = await readCheckedToken(
            ctx,
            chain,
            tokenId,
            scope,
            spamCheck(chain, listedTokens, scope),
        )
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
    listedTokens: ListedTokens,
    query: string,
    scope: ChainScope,
): Promise<DisplayableAsset[]> => {
    if (!isAddress(query, { strict: false })) return []
    const tokenId = getAddress(query)
    if (!isTokenAddress(tokenId)) return []
    try {
        const isSpam = spamCheck(chain, listedTokens, scope)
        return [
            (await readCheckedToken(ctx, chain, tokenId, scope, isSpam)).asset,
        ]
    } catch {
        return []
    }
}

// The backend bounds text search by Unicode code points.
const TOKEN_SEARCH_MIN_LENGTH = 2
const TOKEN_SEARCH_MAX_LENGTH = 100

// The search matches an address only whole and knows only tokens Pera
// stored, so an address or its start is matched against the list here, and a
// pasted one the list lacks is read from the chain.
const ADDRESS_LIKE = /^0x[0-9a-f]*$/i

// The backend's native row carries its own name for the coin; every other
// screen names it from the chain table.
const withChainNativeName =
    (chain: EvmChain) =>
    (asset: DisplayableAsset): DisplayableAsset =>
        asset.assetId === NATIVE_ASSET_ID
            ? {
                  ...asset,
                  name: chain.nativeAsset.name,
                  unitName: chain.nativeAsset.unitName,
              }
            : asset

// The token list, which holds no NFTs, filtered here in one page.
const searchListedTokens = async (
    ctx: ChainContext,
    chain: EvmChain,
    listedTokens: ListedTokens,
    query: string,
    scope: ChainScope,
): Promise<AssetSearchPage> => {
    const assets = (await listedTokens(scope)).map(({ asset }) =>
        withChainNativeName(chain)(asset),
    )
    const needle = query.toLowerCase()
    if (!needle) return { results: assets, nextCursor: undefined }
    const matches = assets.filter(matchesQuery(needle))
    return {
        results:
            matches.length > 0
                ? matches
                : await unlistedToken(ctx, chain, listedTokens, query, scope),
        nextCursor: undefined,
    }
}

// The backend's token search, paged; the token list stands in where the
// chain's build doesn't list the search service.
const search =
    (
        ctx: ChainContext,
        chain: EvmChain,
        listedTokens: ListedTokens,
    ): NonNullable<AssetsChainAdapter['search']> =>
    async ({ query, cursor, hasCollectible }, scope) => {
        eip155ChainIdOf(scope, chain)
        if (hasCollectible) return { results: [], nextCursor: undefined }
        // An empty page would read as "No assets found" on a network that
        // can't be searched at all.
        if (!hasServices(ctx, scope, ASSETS_SERVICE)) {
            throw new PeraServiceUnavailableError(scope, ASSETS_SERVICE, {
                isChainRefused: ctx.getPeraBackend(scope).isChainRefused,
            })
        }
        const trimmed = query.trim()
        const length = [...trimmed].length
        if (
            !hasServices(ctx, scope, TOKEN_SEARCH_SERVICE) ||
            length < TOKEN_SEARCH_MIN_LENGTH ||
            length > TOKEN_SEARCH_MAX_LENGTH ||
            trimmed.includes('\u0000') ||
            ADDRESS_LIKE.test(trimmed)
        ) {
            return searchListedTokens(ctx, chain, listedTokens, trimmed, scope)
        }
        const page = await fetchTokenSearchPage(scope, chain, trimmed, cursor)
        return {
            results: page.items.flatMap(item => {
                const asset = toSearchResult(item, scope, chain)
                return asset ? [withChainNativeName(chain)(asset)] : []
            }),
            nextCursor: page.nextCursor,
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
        syncAssets: syncAssets(ctx, chain, listedTokens),
        getAssetMetadata: getAssetMetadata(ctx, chain, listedTokens),
        findCollectibleMetadata: async (ref, scope) => {
            eip155ChainIdOf(scope, chain)
            const assetId = evmAssetIdOf(chain, ref)
            if (!isEvmNftAssetId(assetId)) return null
            try {
                return await getNftMetadata(ctx, chain, assetId, scope)
            } catch (error) {
                // The lookup's own miss: no NFT service, or one that doesn't know the NFT.
                if (error instanceof InvalidCaip19Error) return null
                throw error
            }
        },
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
