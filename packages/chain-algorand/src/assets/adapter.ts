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
import { isNativeAsset } from '@perawallet/wallet-core-chain-contract'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandDescriptor } from '../descriptor'
import { algorandNetworkOf } from '../network-id'
import { ASSET_PRICES_MAX_IDS_PER_REQUEST } from '../pricing/endpoints'
import { fetchPriceHistory } from '../pricing/price-history'
import { fetchPeraUsdPrices } from '../pricing/provider'
import {
    fetchAssetAuthorities,
    fetchAssetFromApis,
    fetchOnChainAsset,
} from './details'
import { algorandAssetIdOf } from './asset-ref'
import { algorandAssetChainData } from './chain-data'
import { ALGORAND_NATIVE_ASSET } from './native-asset'
import { searchAssetPage } from './search'
import { fetchAndPersistAssets } from './sync/asset-syncer'

export const algorandAssetsAdapter: AssetsChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    priceProvider: 'pera',
    maxPriceIdsPerRequest: ASSET_PRICES_MAX_IDS_PER_REQUEST,
    getNativeAsset: () => ALGORAND_NATIVE_ASSET,
    chainData: algorandAssetChainData,
    // Async so a scope or ref that is not Algorand's rejects rather than
    // throwing past a caller's `.catch`.
    syncAssets: async (refs, scope) => {
        const assetIds = refs.map(algorandAssetIdOf)
        await fetchAndPersistAssets(assetIds, scope)
    },
    getAssetMetadata: async (ref, scope) => {
        algorandNetworkOf(scope)
        const assetId = algorandAssetIdOf(ref)
        return isNativeAsset(ref, algorandDescriptor)
            ? ALGORAND_NATIVE_ASSET
            : fetchAssetFromApis(assetId, scope)
    },
    fetchOnChainAsset: async (ref, scope) =>
        fetchOnChainAsset(algorandAssetIdOf(ref), algorandNetworkOf(scope)),
    fetchAssetAuthorities: async (ref, scope) =>
        fetchAssetAuthorities(algorandAssetIdOf(ref), algorandNetworkOf(scope)),
    search: async (params, scope) =>
        searchAssetPage({ ...params, network: algorandNetworkOf(scope) }),
    getPrices: async (refs, scope) =>
        fetchPeraUsdPrices(refs, algorandNetworkOf(scope)),
    getPriceHistory: async (ref, period, scope) =>
        fetchPriceHistory(
            algorandAssetIdOf(ref),
            period,
            algorandNetworkOf(scope),
        ),
}
