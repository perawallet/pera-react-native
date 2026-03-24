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

import { useEffect } from 'react'
import { logger } from '@perawallet/wallet-core-shared'
import { upsertAssets, getAssetsByIds } from '../db'
import type { PeraAsset } from '../models'

export const getCachedAssets = (
    assetIds: string[],
    network: string,
): Map<string, PeraAsset> => {
    try {
        const assets = getAssetsByIds({ assetIds, network })
        const map = new Map<string, PeraAsset>()

        for (const asset of assets) {
            map.set(asset.assetId, asset)
        }

        return map
    } catch (error) {
        logger.warn('Failed to read cached assets from database', { error })
        return new Map()
    }
}

export const persistAssets = (items: PeraAsset[], network: string): void => {
    try {
        upsertAssets({ items, network })
    } catch (error) {
        logger.warn('Failed to persist assets to database', { error })
    }
}

export const useAssetsCacheSync = (
    fetchedAssets: Map<string, PeraAsset>,
    isFetched: boolean,
    network: string,
): void => {
    useEffect(() => {
        if (isFetched && fetchedAssets.size > 0) {
            persistAssets(Array.from(fetchedAssets.values()), network)
        }
    }, [fetchedAssets, isFetched, network])
}
