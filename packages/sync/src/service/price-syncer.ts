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

import {
    fetchAssetPrices,
    fetchPublicAssetDetails,
    upsertAssetPrices,
    ALGO_ASSET_ID,
} from '@perawallet/wallet-core-assets'
import { partition, type Network } from '@perawallet/wallet-core-shared'

const PRICE_BATCH_SIZE = 25

export async function fetchAndPersistPrices(
    assetIds: string[],
    network: Network,
): Promise<void> {
    if (assetIds.length === 0) return

    const nonAlgoIds = assetIds.filter(id => id !== ALGO_ASSET_ID)
    const batches = partition(nonAlgoIds, PRICE_BATCH_SIZE)

    const results = await Promise.allSettled([
        ...batches.map(async batch => {
            const response = await fetchAssetPrices(batch, network)
            const prices = response.results.map(r => ({
                assetId: `${r.asset_id}`,
                usdPrice: r.usd_value ?? '0',
            }))
            upsertAssetPrices({ prices, network })
        }),
        (async () => {
            const algoDetails = await fetchPublicAssetDetails(
                ALGO_ASSET_ID,
                network,
            )
            upsertAssetPrices({
                prices: [
                    {
                        assetId: ALGO_ASSET_ID,
                        usdPrice: algoDetails.usd_value ?? '0',
                    },
                ],
                network,
            })
        })(),
    ])

    // Re-throw if all batches failed
    const allFailed = results.every(r => r.status === 'rejected')
    if (allFailed && results.length > 0) {
        throw new Error('All price sync batches failed')
    }
}
