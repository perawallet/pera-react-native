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
    getStaleOrMissingAssetIds,
    PeraAssetVerificationTier,
    upsertAssets,
    upsertNodeAssets,
    type AssetsChainAdapter,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { partition } from '@perawallet/wallet-core-shared'
import { ETHEREUM_CHAIN_ID } from '../chain-id'
import { eip155ChainIdOf } from '../blockchain/utils/caip19'
import { readErc20 } from '../blockchain/utils/erc20'
import {
    ASSETS_MAX_IDS,
    ASSETS_SERVICE,
    fetchAssetItems,
    PRICES_SERVICE,
} from './api/endpoints'
import { toAssetMetadata, toPriceRow } from './api/transformers'
import { ETHEREUM_NATIVE_ASSET, NATIVE_ASSET_ID } from './native-asset'

// Token metadata rarely changes; the same window as Algorand's asset cache.
const ASSET_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

const NO_AUTHORITIES = {
    hasFreeze: false,
    hasClawback: false,
    freezeAddress: null,
    clawbackAddress: null,
} as const

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
    assetIds: string[],
    scope: ChainScope,
): Promise<PeraAsset[]> => {
    const reads = await Promise.allSettled(
        assetIds.map(id => readErc20(ctx, id, scope)),
    )
    return reads.flatMap(read =>
        read.status === 'fulfilled' ? [read.value] : [],
    )
}

const persistOnChain = async (
    ctx: ChainContext,
    assetIds: string[],
    scope: ChainScope,
): Promise<void> => {
    const items = await readOnChain(ctx, assetIds, scope)
    if (items.length > 0) await upsertNodeAssets({ items, scope })
}

// Both halves, so the suspicious tier is persisted, not just the intrinsics.
const persistQuarantined = async (
    ctx: ChainContext,
    assetIds: string[],
    scope: ChainScope,
): Promise<void> => {
    const items = (await readOnChain(ctx, assetIds, scope)).map(asSuspicious)
    if (items.length > 0) await upsertAssets({ items, scope })
}

const syncAssets =
    (ctx: ChainContext): AssetsChainAdapter['syncAssets'] =>
    async (assetIds, scope) => {
        const tokenIds = toTokenIds(assetIds)
        if (tokenIds.length === 0) return
        const stale = await getStaleOrMissingAssetIds({
            assetIds: tokenIds,
            scope,
            ttlMs: ASSET_CACHE_TTL_MS,
        })
        if (stale.length === 0) return

        if (!hasServices(ctx, scope, ASSETS_SERVICE)) {
            await persistOnChain(ctx, stale, scope)
            return
        }

        const unknown: string[] = []
        const quarantined: string[] = []
        for (const batch of partition(stale, ASSETS_MAX_IDS)) {
            const items = await fetchAssetItems(scope, batch)
            const known = items.flatMap((item, index) => {
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
        if (unknown.length > 0) await persistOnChain(ctx, unknown, scope)
        if (quarantined.length > 0) {
            await persistQuarantined(ctx, quarantined, scope)
        }
    }

const fetchAsset =
    (ctx: ChainContext): AssetsChainAdapter['fetchAsset'] =>
    async (assetId, scope) => {
        if (assetId === NATIVE_ASSET_ID) return ETHEREUM_NATIVE_ASSET
        const tokenId = getAddress(assetId)
        if (!isTokenAddress(tokenId)) {
            throw new InvalidAddressError({ address: assetId })
        }
        const [chain, pera] = await Promise.allSettled([
            readErc20(ctx, tokenId, scope),
            hasServices(ctx, scope, ASSETS_SERVICE)
                ? fetchAssetItems(scope, [tokenId])
                : [],
        ])
        const item =
            pera.status === 'fulfilled' && pera.value[0]
                ? toAssetMetadata(tokenId, pera.value[0])
                : undefined
        const fromPera = item?.asset ?? null
        if (chain.status === 'rejected') {
            // A quarantined token has no backend record to fall back on.
            if (!fromPera) throw chain.reason
            // Unverified decimals: caching them would keep them for the TTL.
            return fromPera
        }
        // A failed cache write must not fail the read.
        if (item?.isQuarantined) {
            const asset = asSuspicious(chain.value)
            // Both halves, as in syncAssets: a node row alone would read as
            // fresh and render without the tier.
            await upsertAssets({ items: [asset], scope }).catch(() => undefined)
            return asset
        }
        const asset = fromPera
            ? withChainIntrinsics(fromPera, chain.value)
            : chain.value
        await upsertNodeAssets({ items: [asset], scope }).catch(() => undefined)
        return asset
    }

// Prices ride on the v4 asset items, so they need the `assets` service as
// well as `prices`; without both every ref is a miss. A row is keyed back to
// the ref it was asked for, whatever case its address came in.
const getPrices =
    (ctx: ChainContext): AssetsChainAdapter['getPrices'] =>
    async (refs, scope) => {
        eip155ChainIdOf(scope)
        const foreign = refs.find(ref => ref.chainId !== ETHEREUM_CHAIN_ID)
        if (foreign) {
            throw new Error(`Not an Ethereum asset: ${assetRefKey(foreign)}`)
        }
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
                const items = await fetchAssetItems(scope, batch)
                return items.flatMap((item, index) => {
                    const row = toPriceRow(batch[index]!, item)
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

export const createEthereumAssetsAdapter = (
    ctx: ChainContext,
): AssetsChainAdapter => {
    return {
        chainId: ETHEREUM_CHAIN_ID,
        priceProvider: 'pera',
        maxPriceIdsPerRequest: ASSETS_MAX_IDS,
        getNativeAsset: () => ETHEREUM_NATIVE_ASSET,
        syncAssets: syncAssets(ctx),
        fetchAsset: fetchAsset(ctx),
        fetchOnChainAsset: async (assetId, scope) =>
            assetId === NATIVE_ASSET_ID
                ? ETHEREUM_NATIVE_ASSET
                : readErc20(ctx, assetId, scope),
        // ERC-20 has no freeze or clawback.
        fetchAssetAuthorities: async () => NO_AUTHORITIES,
        // The backend has no EVM token search, and `assetSearch` is off for
        // Ethereum.
        searchAssets: async () => ({ results: [], nextCursor: undefined }),
        getPrices: getPrices(ctx),
    }
}
