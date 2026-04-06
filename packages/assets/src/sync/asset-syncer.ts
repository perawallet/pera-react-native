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

import { fetchAssets, transformAssetResponse } from '../api'
import { upsertAssets } from '../db'
import { ALGO_ASSET_ID } from '../models'
import { logger, partition, type Network } from '@perawallet/wallet-core-shared'

const ASSET_BATCH_SIZE = 25

export async function fetchAndPersistAssets(
    assetIds: string[],
    network: Network,
): Promise<void> {
    const nonAlgoIds = assetIds.filter(id => id !== ALGO_ASSET_ID)

    if (nonAlgoIds.length === 0) return

    const batches = partition(nonAlgoIds, ASSET_BATCH_SIZE)

    await Promise.allSettled(
        batches.map(async batch => {
            const response = await fetchAssets(batch, network)
            const assets = response.results.map(transformAssetResponse)
            await upsertAssets({ items: assets, network })
        }),
    )
}
