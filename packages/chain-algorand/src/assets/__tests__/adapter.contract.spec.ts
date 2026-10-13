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

import { vi } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    assetMetadataContractTests,
    assetPriceContractTests,
} from '@perawallet/wallet-core-assets/testing/adapter-contract'
import { nodeBackendAdapters } from '@perawallet/wallet-core-shared'
import { algorandNodeBackends } from '../../blockchain/node-backends'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { mockAssetPrices } from '../../pricing/msw-handlers'
import {
    mockAssetDetails,
    mockAssets,
    mockIndexerAssetDetails,
    mockPublicAssetDetails,
} from '../api/msw-handlers'
import { mockAssetSearch } from '../api/search-msw-handlers'
import { algorandAssetsAdapter } from '../adapter'
import { ALGORAND_NATIVE_ASSET } from '../native-asset'

const persisted = vi.hoisted(() => ({ ids: new Set<string>() }))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const record = async ({ items }: { items: { assetId: string }[] }) => {
        items.forEach(item => persisted.ids.add(item.assetId))
    }
    return {
        ...(await importOriginal<object>()),
        getStaleOrMissingAssetIds: async ({
            assetIds,
        }: {
            assetIds: string[]
        }) => assetIds,
        getCollectibleIdsMissingUrl: async () => [],
        upsertAssets: record,
        upsertNodeAssets: record,
    }
})

vi.mock('@perawallet/wallet-core-device', async importOriginal => ({
    ...(await importOriginal<object>()),
    deviceIdFor: () => null,
}))

nodeBackendAdapters.register(algorandNodeBackends)

const TOKEN = { assetId: '31566704', unitName: 'USDC', decimals: 6 }
const FREEZE_ADDRESS =
    'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'

const usdcDetails = {
    asset_id: 31_566_704,
    name: 'USDC',
    unit_name: 'USDC',
    fraction_decimals: 6,
    total: '18446744073709551615',
    is_deleted: false,
    verification_tier: 'verified',
    creator: { address: 'CREATOR' },
    category: null,
}

const usdcIndexer = {
    asset: {
        index: 31_566_704,
        params: {
            creator: 'CREATOR',
            decimals: 6,
            name: 'USDC',
            'unit-name': 'USDC',
            total: 18_446_744_073_709_551_615n.toString(),
            freeze: FREEZE_ADDRESS,
        },
    },
    'current-round': 1,
}

const usdcSearchHit = {
    asset_id: 31_566_704,
    name: 'USDC',
    unit_name: 'USDC',
    verification_tier: 'verified' as const,
}

const indexerHandler = mockIndexerAssetDetails({
    assetID: TOKEN.assetId,
    response: usdcIndexer,
})

const authorities = {
    hasFreeze: true,
    freezeAddress: FREEZE_ADDRESS,
    hasClawback: false,
    clawbackAddress: null,
}

const runMetadata = (
    networkId: string,
    label: string,
    handlers: Parameters<typeof assetMetadataContractTests>[1]['handlers'],
    search?: Parameters<typeof assetMetadataContractTests>[1]['search'],
) =>
    assetMetadataContractTests(
        () => {
            persisted.ids.clear()
            return algorandAssetsAdapter
        },
        {
            scope: { chainId: ALGORAND_CHAIN_ID, networkId },
            nativeAssetId: ALGORAND_NATIVE_ASSET.assetId,
            token: TOKEN,
            tokenAuthorities: authorities,
            search,
            handlers,
            persistedIds: () => [...persisted.ids],
        },
        label,
    )

runMetadata(
    'mainnet',
    'Pera backend',
    [
        mockAssetDetails({ assetID: TOKEN.assetId, response: usdcDetails }),
        mockPublicAssetDetails({
            assetID: TOKEN.assetId,
            response: {
                asset_id: 31_566_704,
                name: 'USDC',
                unit_name: 'USDC',
                fraction_decimals: 6,
                total_supply: '18446744073709551615',
                total_supply_as_str: '18446744073709551615',
                verification_tier: 'verified',
                is_collectible: false,
            },
        }),
        indexerHandler,
        ...mockAssets({ response: { results: [usdcDetails] } }),
        mockAssetSearch({ response: { results: [usdcSearchHit] } }),
    ],
    { query: 'usdc', hitAssetIds: [TOKEN.assetId] },
)

// No Pera deployment: the Pera lanes fail before any request, so the chain's
// own indexer is the only source and there is no catalogue search.
runMetadata('betanet', 'indexer only', [indexerHandler])

assetPriceContractTests(
    () => algorandAssetsAdapter,
    {
        scope: { chainId: ALGORAND_CHAIN_ID, networkId: 'mainnet' },
        priced: {
            assetRef: { chainId: ALGORAND_CHAIN_ID, assetId: '31566704' },
            usdPrice: new Decimal('1.0001'),
        },
        unpriced: { chainId: ALGORAND_CHAIN_ID, assetId: '386192725' },
        nativeUsdPrice: new Decimal('0.25'),
        handlers: [
            mockPublicAssetDetails({
                assetID: '0',
                response: {
                    asset_id: 0,
                    name: 'Algo',
                    unit_name: 'ALGO',
                    fraction_decimals: 6,
                    total_supply: 10000000000,
                    total_supply_as_str: '10000000000',
                    verification_tier: 'verified',
                    is_collectible: false,
                    usd_value: '0.25',
                },
            }),
            mockAssetPrices({
                response: [
                    { asset_id: '31566704', price: '1.0001', currency: 'USD' },
                    { asset_id: '386192725', price: null, currency: 'USD' },
                ],
            }),
        ],
    },
    'algorand',
)
