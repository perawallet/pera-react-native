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

import type { AssetsChainAdapter } from '@perawallet/wallet-core-assets'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandNetworkOf } from '../legacy-network'
import { ASSET_PRICES_MAX_IDS_PER_REQUEST } from '../pricing/endpoints'
import { fetchNativeUsdPrice, fetchUsdPrices } from '../pricing/prices'
import {
    fetchAssetAuthorities,
    fetchAssetFromApis,
    fetchOnChainAsset,
} from './details'
import { ALGORAND_NATIVE_ASSET } from './native-asset'
import { searchAssetPage } from './search'
import { fetchAndPersistAssets } from './sync/asset-syncer'

export const algorandAssetsAdapter: AssetsChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    maxPriceIdsPerRequest: ASSET_PRICES_MAX_IDS_PER_REQUEST,
    getNativeAsset: () => ALGORAND_NATIVE_ASSET,
    // Async so a scope that is not Algorand's rejects rather than throwing
    // past a caller's `.catch`.
    syncAssets: async (assetIds, scope) =>
        fetchAndPersistAssets(assetIds, scope),
    fetchAsset: async (assetId, scope) => fetchAssetFromApis(assetId, scope),
    fetchOnChainAsset: async (assetId, scope) =>
        fetchOnChainAsset(assetId, algorandNetworkOf(scope)),
    fetchAssetAuthorities: async (assetId, scope) =>
        fetchAssetAuthorities(assetId, algorandNetworkOf(scope)),
    searchAssets: async (params, scope) =>
        searchAssetPage({ ...params, network: algorandNetworkOf(scope) }),
    fetchNativeUsdPrice: async scope =>
        fetchNativeUsdPrice(algorandNetworkOf(scope)),
    fetchUsdPrices: async (assetIds, scope) =>
        fetchUsdPrices(assetIds, algorandNetworkOf(scope)),
}
