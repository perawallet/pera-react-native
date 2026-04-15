/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { Decimal } from 'decimal.js'
import {
    assetPricesKey,
    assetsNodeKey,
    assetsPeraKey,
    getCollections,
    type AssetPriceCollectionRow,
    type AssetsNodeRow,
    type AssetsPeraRow,
    type CollectionRegistry,
} from '@perawallet/wallet-core-database'
import {
    DEFAULT_ASSET_METADATA,
    type PeraAsset,
    type PeraAssetMetadata,
} from '../models'

type WithRegistry = { registry?: CollectionRegistry }

function resolveRegistry(registry: CollectionRegistry | undefined): CollectionRegistry {
    return registry ?? getCollections()
}

function parseMetaJson(json: string | null): PeraAssetMetadata | undefined {
    if (!json) return undefined
    try {
        return JSON.parse(json) as PeraAssetMetadata
    } catch {
        return undefined
    }
}

function rowsToPeraAsset(
    node: AssetsNodeRow,
    pera: AssetsPeraRow | undefined,
): PeraAsset {
    return {
        assetId: node.assetId.toString(),
        decimals: node.decimals,
        creator: { address: node.creatorAddress },
        totalSupply: node.totalSupply,
        name: node.name ?? undefined,
        unitName: node.unitName ?? undefined,
        url: node.url ?? undefined,
        metadata: node.metadata ?? undefined,
        peraMetadata: parseMetaJson(pera?.peraMetadataJson ?? null),
    }
}

// ---------------------------------------------------------------------------
// Node-level asset writes
// ---------------------------------------------------------------------------

type UpsertNodeAssetsParams = WithRegistry & {
    items: PeraAsset[]
    network: string
}

export async function upsertNodeAssets({
    registry,
    items,
    network,
}: UpsertNodeAssetsParams): Promise<void> {
    if (items.length === 0) return

    const { assetsNode } = resolveRegistry(registry)
    const now = Date.now()

    assetsNode.upsertMany(
        items.map<AssetsNodeRow>(item => ({
            network,
            assetId: new Decimal(item.assetId),
            decimals: item.decimals,
            creatorAddress: item.creator.address,
            totalSupply: item.totalSupply,
            name: item.name ?? null,
            unitName: item.unitName ?? null,
            url: item.url ?? null,
            metadata: item.metadata ?? null,
            updatedAt: now,
        })),
    )
}

// ---------------------------------------------------------------------------
// Pera-specific asset writes (preserves device-local fields)
// ---------------------------------------------------------------------------

type UpsertPeraAssetsParams = WithRegistry & {
    items: PeraAsset[]
    network: string
}

/**
 * Batch upsert pera metadata, preserving device-local fields.
 *
 * `isFavorited` and `isPriceAlertEnabled` are set only by user toggles
 * (see `updateAssetPeraMetadata`) and are absent from the sync API
 * payload. We must not clobber them when the syncer writes a fresh row.
 *
 * Strategy: read the existing row first (sync map lookup) and merge the
 * two device-local fields into the incoming payload before writing.
 */
export async function upsertPeraAssets({
    registry,
    items,
    network,
}: UpsertPeraAssetsParams): Promise<void> {
    if (items.length === 0) return

    const { assetsPera } = resolveRegistry(registry)
    const now = Date.now()

    assetsPera.transact(() => {
        for (const item of items) {
            const meta = item.peraMetadata
            const existingRow = assetsPera.get(
                assetsPeraKey({ network, assetId: item.assetId }),
            )
            const existingMeta = parseMetaJson(
                existingRow?.peraMetadataJson ?? null,
            )

            const mergedMeta: PeraAssetMetadata | undefined = meta
                ? {
                      ...meta,
                      isFavorited:
                          existingMeta?.isFavorited ?? meta.isFavorited,
                      isPriceAlertEnabled:
                          existingMeta?.isPriceAlertEnabled ??
                          meta.isPriceAlertEnabled,
                  }
                : undefined

            assetsPera.upsert({
                network,
                assetId: new Decimal(item.assetId),
                verificationTier: meta?.verificationTier ?? 'unverified',
                isDeleted: meta?.isDeleted ?? false,
                assetType: meta?.type ?? null,
                peraMetadataJson: mergedMeta ? JSON.stringify(mergedMeta) : null,
                updatedAt: now,
            })
        }
    })
}

// ---------------------------------------------------------------------------
// Unified upsert — writes both tables
// ---------------------------------------------------------------------------

type UpsertAssetsParams = WithRegistry & {
    items: PeraAsset[]
    network: string
}

export async function upsertAssets({
    registry,
    items,
    network,
}: UpsertAssetsParams): Promise<void> {
    await upsertNodeAssets({ registry, items, network })
    await upsertPeraAssets({ registry, items, network })
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

type GetAssetsByIdsParams = WithRegistry & {
    assetIds: string[]
    network: string
}

export async function getAssetsByIds({
    registry,
    assetIds,
    network,
}: GetAssetsByIdsParams): Promise<PeraAsset[]> {
    if (assetIds.length === 0) return []

    const { assetsNode, assetsPera } = resolveRegistry(registry)
    const results: PeraAsset[] = []
    for (const assetId of assetIds) {
        const node = assetsNode.get(assetsNodeKey({ network, assetId }))
        if (node === undefined) continue
        const pera = assetsPera.get(assetsPeraKey({ network, assetId }))
        results.push(rowsToPeraAsset(node, pera))
    }
    return results
}

type GetAssetByIdParams = WithRegistry & {
    assetId: string
    network: string
}

export async function getAssetById({
    registry,
    assetId,
    network,
}: GetAssetByIdParams): Promise<PeraAsset | null> {
    const results = await getAssetsByIds({
        registry,
        assetIds: [assetId],
        network,
    })
    return results[0] ?? null
}

type GetAssetPeraMetadataParams = WithRegistry & {
    assetId: string
    network: string
}

export async function getAssetPeraMetadata({
    registry,
    assetId,
    network,
}: GetAssetPeraMetadataParams): Promise<PeraAssetMetadata | null> {
    const { assetsPera } = resolveRegistry(registry)
    const row = assetsPera.get(assetsPeraKey({ network, assetId }))
    return parseMetaJson(row?.peraMetadataJson ?? null) ?? null
}

// ---------------------------------------------------------------------------
// Update asset metadata from the user side (favorites, price alerts)
// ---------------------------------------------------------------------------

type UpdateAssetPeraMetadataParams = WithRegistry & {
    assetId: string
    network: string
    updates: Partial<PeraAssetMetadata>
}

/**
 * Read-merge-write for user-driven metadata toggles.
 *
 * Semantics mirror the old SQL path: start from defaults, layer the
 * persisted metadata on top, then apply the incoming updates last so
 * `updates` always wins. This is the place `isFavorited` /
 * `isPriceAlertEnabled` get written — `upsertPeraAssets` (sync path)
 * never touches them.
 */
export async function updateAssetPeraMetadata({
    registry,
    assetId,
    network,
    updates,
}: UpdateAssetPeraMetadataParams): Promise<void> {
    const { assetsPera } = resolveRegistry(registry)
    const key = assetsPeraKey({ network, assetId })
    const existingRow = assetsPera.get(key)
    const existingMeta = parseMetaJson(existingRow?.peraMetadataJson ?? null)

    const merged: PeraAssetMetadata = {
        ...DEFAULT_ASSET_METADATA,
        ...existingMeta,
        ...updates,
    }

    assetsPera.upsert({
        network,
        assetId: new Decimal(assetId),
        verificationTier: merged.verificationTier,
        isDeleted: merged.isDeleted,
        assetType: existingRow?.assetType ?? null,
        peraMetadataJson: JSON.stringify(merged),
        updatedAt: Date.now(),
    })
}

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

export type AssetPriceRow = {
    assetId: string
    usdPrice: Decimal
}

type UpsertAssetPricesParams = WithRegistry & {
    prices: AssetPriceRow[]
    network: string
}

export async function upsertAssetPrices({
    registry,
    prices,
    network,
}: UpsertAssetPricesParams): Promise<void> {
    if (prices.length === 0) return

    const { assetPrices } = resolveRegistry(registry)
    const now = Date.now()

    assetPrices.upsertMany(
        prices.map<AssetPriceCollectionRow>(price => ({
            network,
            assetId: new Decimal(price.assetId),
            usdPrice: price.usdPrice,
            updatedAt: now,
        })),
    )
}

type GetAssetPricesByIdsParams = WithRegistry & {
    assetIds: string[]
    network: string
}

export async function getAssetPricesByIds({
    registry,
    assetIds,
    network,
}: GetAssetPricesByIdsParams): Promise<AssetPriceRow[]> {
    if (assetIds.length === 0) return []

    const { assetPrices } = resolveRegistry(registry)
    const results: AssetPriceRow[] = []
    for (const assetId of assetIds) {
        const row = assetPrices.get(assetPricesKey({ network, assetId }))
        if (row === undefined) continue
        results.push({
            assetId: row.assetId.toString(),
            usdPrice: row.usdPrice,
        })
    }
    return results
}
