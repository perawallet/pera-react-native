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

import { Decimal } from 'decimal.js'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import {
    PeraAssetType,
    PeraAssetVerificationTier,
    type PeraAsset,
} from '../models'
import {
    assetMetadataContractTests,
    assetPriceContractTests,
} from './assets-adapter-contract'
import { FAKE_NATIVE_ASSET, fakeAssetsAdapter } from './fakeAssetsChain'

const persisted: string[] = []

const TOKEN = { assetId: '31566704', unitName: 'USDC', decimals: 6 }

const USDC: PeraAsset = {
    ...TOKEN,
    name: 'USDC',
    totalSupply: new Decimal('18446744073709551615'),
    creator: { address: '' },
    peraMetadata: {
        isDeleted: false,
        verificationTier: PeraAssetVerificationTier.verified,
        type: PeraAssetType.standard_asset,
    },
}

const knownToken = async (assetId: string): Promise<PeraAsset> => {
    if (assetId !== USDC.assetId) throw new Error(`Unknown asset ${assetId}`)
    return USDC
}

assetMetadataContractTests(
    () =>
        fakeAssetsAdapter({
            syncAssets: async ids => {
                persisted.push(...ids)
            },
            fetchAsset: knownToken,
            fetchOnChainAsset: knownToken,
        }),
    {
        scope: scopeForLegacyNetwork('mainnet'),
        nativeAssetId: FAKE_NATIVE_ASSET.assetId,
        token: TOKEN,
        handlers: [],
        persistedIds: () => persisted,
    },
    'fake',
)

const PRICED = { assetId: '31566704', usdPrice: new Decimal('1.0001') }
const UNPRICED_ID = '386192725'
const ALGO_PRICE = new Decimal('0.25')

assetPriceContractTests(
    () =>
        fakeAssetsAdapter({
            fetchUsdPrices: async ids =>
                ids.includes(PRICED.assetId) ? [PRICED] : [],
            fetchNativeUsdPrice: async () => ALGO_PRICE,
        }),
    {
        scope: scopeForLegacyNetwork('mainnet'),
        priced: PRICED,
        unpricedAssetId: UNPRICED_ID,
        nativeUsdPrice: ALGO_PRICE,
        handlers: [],
    },
    'fake',
)
