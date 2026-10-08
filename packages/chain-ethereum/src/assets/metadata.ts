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
import type {
    ChainContext,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type {
    AssetsChainAdapter,
    PeraAsset,
} from '@perawallet/wallet-core-assets'
import { partition } from '@perawallet/wallet-core-shared'
import { ETHEREUM_CHAIN_ID } from '../chain-id'
import { readErc20 } from '../blockchain/utils/erc20'
import { ASSETS_SERVICE, fetchAssetItems } from './api/endpoints'
import { ETHEREUM_NATIVE_ASSET, NATIVE_ASSET_ID } from './native-asset'

export type EthereumAssetOps = Pick<
    AssetsChainAdapter,
    'getNativeAsset' | 'syncAssets' | 'fetchAsset' | 'fetchOnChainAsset'
> & { readonly chainId: typeof ETHEREUM_CHAIN_ID }

/** Shaped like the `@perawallet/wallet-core-assets` repository functions, so registration passes them in as they are. */
export type EthereumAssetPersistence = {
    getStaleOrMissingAssetIds(params: {
        assetIds: string[]
        scope: ChainScope
        ttlMs: number
    }): Promise<string[]>
    upsertAssets(params: {
        items: PeraAsset[]
        scope: ChainScope
    }): Promise<void>
    upsertNodeAssets(params: {
        items: PeraAsset[]
        scope: ChainScope
    }): Promise<void>
}

// Token metadata rarely changes; the same window as Algorand's asset cache.
const ASSET_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
// The backend's per-request limit.
const BULK_CHUNK_SIZE = 500

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
        verificationTier: 'suspicious',
    },
})

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
    persistence: EthereumAssetPersistence,
    assetIds: string[],
    scope: ChainScope,
): Promise<void> => {
    const items = await readOnChain(ctx, assetIds, scope)
    if (items.length > 0) {
        await persistence.upsertNodeAssets({ items, scope })
    }
}

// Both halves, so the suspicious tier is persisted, not just the intrinsics.
const persistQuarantined = async (
    ctx: ChainContext,
    persistence: EthereumAssetPersistence,
    assetIds: string[],
    scope: ChainScope,
): Promise<void> => {
    const items = (await readOnChain(ctx, assetIds, scope)).map(asSuspicious)
    if (items.length > 0) {
        await persistence.upsertAssets({ items, scope })
    }
}

// The backend rejects the whole batch for an erc20 id at the zero address,
// its native coin's contract.
const isTokenAddress = (address: string): boolean => address !== zeroAddress

const syncAssets =
    (
        ctx: ChainContext,
        persistence: EthereumAssetPersistence,
    ): EthereumAssetOps['syncAssets'] =>
    async (assetIds, scope) => {
        // Ids reach the cache checksummed, whatever case the caller used.
        const tokenIds = [
            ...new Set(
                assetIds
                    .filter(id => id !== NATIVE_ASSET_ID && isAddress(id))
                    .map(id => getAddress(id))
                    .filter(isTokenAddress),
            ),
        ]
        if (tokenIds.length === 0) return
        const stale = await persistence.getStaleOrMissingAssetIds({
            assetIds: tokenIds,
            scope,
            ttlMs: ASSET_CACHE_TTL_MS,
        })
        if (stale.length === 0) return

        if (!ctx.getPeraBackend(scope).services.has(ASSETS_SERVICE)) {
            await persistOnChain(ctx, persistence, stale, scope)
            return
        }

        const unknown: string[] = []
        const quarantined: string[] = []
        for (const batch of partition(stale, BULK_CHUNK_SIZE)) {
            const answers = await fetchAssetItems(scope, batch)
            const items = answers.flatMap(
                ({ assetId, asset, isQuarantined }) => {
                    if (asset) return [asset]
                    if (isQuarantined) quarantined.push(assetId)
                    else unknown.push(assetId)
                    return []
                },
            )
            if (items.length > 0) {
                await persistence.upsertAssets({ items, scope })
            }
        }
        if (unknown.length > 0) {
            await persistOnChain(ctx, persistence, unknown, scope)
        }
        if (quarantined.length > 0) {
            await persistQuarantined(ctx, persistence, quarantined, scope)
        }
    }

const fetchAsset =
    (
        ctx: ChainContext,
        persistence: EthereumAssetPersistence,
    ): EthereumAssetOps['fetchAsset'] =>
    async (assetId, scope) => {
        if (assetId === NATIVE_ASSET_ID) return ETHEREUM_NATIVE_ASSET
        const tokenId = getAddress(assetId)
        if (!isTokenAddress(tokenId)) {
            throw new InvalidAddressError({ address: assetId })
        }
        const [chain, pera] = await Promise.allSettled([
            readErc20(ctx, tokenId, scope),
            ctx.getPeraBackend(scope).services.has(ASSETS_SERVICE)
                ? fetchAssetItems(scope, [tokenId])
                : [],
        ])
        const item = pera.status === 'fulfilled' ? pera.value[0] : undefined
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
            await persistence
                .upsertAssets({ items: [asset], scope })
                .catch(() => undefined)
            return asset
        }
        const asset = fromPera
            ? withChainIntrinsics(fromPera, chain.value)
            : chain.value
        await persistence
            .upsertNodeAssets({ items: [asset], scope })
            .catch(() => undefined)
        return asset
    }

/** Not registered: Ethereum's assets adapter also needs pricing and search. */
export const createEthereumAssetOps = (
    ctx: ChainContext,
    persistence: EthereumAssetPersistence,
): EthereumAssetOps => ({
    chainId: ETHEREUM_CHAIN_ID,
    getNativeAsset: () => ETHEREUM_NATIVE_ASSET,
    syncAssets: syncAssets(ctx, persistence),
    fetchAsset: fetchAsset(ctx, persistence),
    fetchOnChainAsset: async (assetId, scope) =>
        assetId === NATIVE_ASSET_ID
            ? ETHEREUM_NATIVE_ASSET
            : readErc20(ctx, assetId, scope),
})
