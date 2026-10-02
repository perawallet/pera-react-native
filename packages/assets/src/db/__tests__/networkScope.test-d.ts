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

import { describe, expectTypeOf, it } from 'vitest'
import type {
    ChainScope,
    ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import {
    deleteAssets,
    getAssetById,
    getAssetPeraMetadata,
    getAssetsByIds,
    updateAssetPeraMetadata,
    upsertAssets,
    upsertNodeAssets,
    upsertPeraAssets,
} from '../metadataRepository'
import {
    clearPriceMisses,
    deleteAssetPrices,
    getAssetPricesByIds,
    recordPriceMisses,
    upsertAssetPrices,
} from '../pricesRepository'
import {
    getCollectibleIdsMissingUrl,
    getStaleOrMissingAssetIds,
    getStaleOrMissingPriceAssetIds,
} from '../syncQueries'
import {
    AssetPriceMissesSchema,
    AssetPricesSchema,
    AssetsNodeSchema,
    AssetsPeraSchema,
} from '../schema'

type ScopeOf<F extends (params: never) => unknown> = Parameters<F>[0] extends {
    scope: infer S
}
    ? S
    : never

describe('assets repositories take a ChainScope', () => {
    it('types every network parameter as a ChainScope', () => {
        expectTypeOf<ScopeOf<typeof upsertAssets>>().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof upsertNodeAssets>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof upsertPeraAssets>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof getAssetsByIds>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<ScopeOf<typeof getAssetById>>().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof getAssetPeraMetadata>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof updateAssetPeraMetadata>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<ScopeOf<typeof deleteAssets>>().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof upsertAssetPrices>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof getAssetPricesByIds>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof recordPriceMisses>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof clearPriceMisses>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof deleteAssetPrices>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof getStaleOrMissingAssetIds>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof getStaleOrMissingPriceAssetIds>
        >().toEqualTypeOf<ChainScope>()
        expectTypeOf<
            ScopeOf<typeof getCollectibleIdsMissingUrl>
        >().toEqualTypeOf<ChainScope>()
    })

    it('rejects a bare network string', () => {
        expectTypeOf<'mainnet'>().not.toExtend<ChainScope>()
        expectTypeOf<string>().not.toExtend<ChainScope>()
        // @ts-expect-error a network name is not a scope
        void getAssetsByIds({ assetIds: ['1'], scope: 'mainnet' })
        // @ts-expect-error a network key is not accepted
        void getAssetsByIds({ assetIds: ['1'], network: 'mainnet' })
        // @ts-expect-error a network name is not a scope
        void upsertAssetPrices({ prices: [], scope: 'mainnet' })
        // @ts-expect-error a network key is not accepted
        void upsertAssetPrices({ prices: [], network: 'mainnet' })
    })

    it('brands every network column as a scope key', () => {
        expectTypeOf(
            AssetsNodeSchema.network._.data,
        ).toEqualTypeOf<ChainScopeKey>()
        expectTypeOf(
            AssetsPeraSchema.network._.data,
        ).toEqualTypeOf<ChainScopeKey>()
        expectTypeOf(
            AssetPricesSchema.network._.data,
        ).toEqualTypeOf<ChainScopeKey>()
        expectTypeOf(
            AssetPriceMissesSchema.network._.data,
        ).toEqualTypeOf<ChainScopeKey>()
    })
})
