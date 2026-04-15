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

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
    bootstrapTestCollections,
    resetRegistryForTest,
    type CollectionRegistry,
} from '@perawallet/wallet-core-database'
import { ALGO_ASSET_ID } from '../../models'
import { getAssetsByIds } from '../repository'
import { seedAlgoAsset } from '../seed'

describe('seedAlgoAsset', () => {
    let registry: CollectionRegistry

    beforeEach(() => {
        registry = bootstrapTestCollections()
    })

    afterEach(() => {
        resetRegistryForTest()
    })

    it('seeds ALGO into both mainnet and testnet', async () => {
        await seedAlgoAsset(registry)

        const mainnet = await getAssetsByIds({
            registry,
            assetIds: [ALGO_ASSET_ID],
            network: 'mainnet',
        })
        const testnet = await getAssetsByIds({
            registry,
            assetIds: [ALGO_ASSET_ID],
            network: 'testnet',
        })

        expect(mainnet).toHaveLength(1)
        expect(mainnet[0].assetId).toBe(ALGO_ASSET_ID)
        expect(mainnet[0].name).toBe('Algo')
        expect(mainnet[0].unitName).toBe('ALGO')
        expect(mainnet[0].decimals).toBe(6)

        expect(testnet).toHaveLength(1)
        expect(testnet[0].assetId).toBe(ALGO_ASSET_ID)
    })

    it('is idempotent — running twice does not duplicate', async () => {
        await seedAlgoAsset(registry)
        await seedAlgoAsset(registry)

        const result = await getAssetsByIds({
            registry,
            assetIds: [ALGO_ASSET_ID],
            network: 'mainnet',
        })

        expect(result).toHaveLength(1)
    })
})
