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

import { BatchQueue } from '@perawallet/wallet-core-shared/queue'
import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import { fetchAndPersistAssets } from '../sync/asset-syncer'
import { getAssetsByIds } from '../db'
import type { PeraAsset } from '../models'

const ASSET_BATCH_DELAY_MS = 100 // same value as NFD

/**
 * On-demand asset batch queue. Used by `useSingleAssetDetailsQuery`'s DB-miss
 * path to coalesce concurrent asset lookups (e.g. a list mounting 30 rows
 * over a few render commits) into a single bulk-read HTTP call.
 */
export const assetBatchQueue = new BatchQueue<
    string,
    Nullable<PeraAsset>,
    Network
>(async (assetIds, network) => {
    await fetchAndPersistAssets(assetIds, network)

    const assets = await getAssetsByIds({ assetIds, network })
    const map = new Map<string, Nullable<PeraAsset>>()
    for (const asset of assets) {
        map.set(asset.assetId, asset)
    }
    return map
}, ASSET_BATCH_DELAY_MS)
