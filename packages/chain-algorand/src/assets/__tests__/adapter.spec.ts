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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

const mocks = vi.hoisted(() => ({
    fetchAndPersistAssets: vi.fn(),
    fetchAssetFromApis: vi.fn(),
    fetchOnChainAsset: vi.fn(),
    fetchAssetAuthorities: vi.fn(),
    searchAssetPage: vi.fn(),
    fetchNativeUsdPrice: vi.fn(),
    fetchUsdPrices: vi.fn(),
}))

vi.mock('../sync/asset-syncer', () => ({
    fetchAndPersistAssets: mocks.fetchAndPersistAssets,
}))
vi.mock('../details', () => ({
    fetchAssetFromApis: mocks.fetchAssetFromApis,
    fetchOnChainAsset: mocks.fetchOnChainAsset,
    fetchAssetAuthorities: mocks.fetchAssetAuthorities,
}))
vi.mock('../search', () => ({ searchAssetPage: mocks.searchAssetPage }))
vi.mock('../../pricing/prices', () => ({
    fetchNativeUsdPrice: mocks.fetchNativeUsdPrice,
    fetchUsdPrices: mocks.fetchUsdPrices,
}))

import { algorandAssetsAdapter } from '../adapter'
import { ALGORAND_NATIVE_ASSET } from '../native-asset'

const testnet: ChainScope = { chainId: 'algorand', networkId: 'testnet' }
const foreign = {
    chainId: 'other',
    networkId: 'mainnet',
} as unknown as ChainScope

describe('algorandAssetsAdapter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns the same native asset instance on every call', () => {
        expect(algorandAssetsAdapter.getNativeAsset()).toBe(
            ALGORAND_NATIVE_ASSET,
        )
        expect(algorandAssetsAdapter.getNativeAsset()).toBe(
            algorandAssetsAdapter.getNativeAsset(),
        )
    })

    it('passes the scope, or its network, to the asset sources', async () => {
        await algorandAssetsAdapter.syncAssets(['1'], testnet)
        await algorandAssetsAdapter.fetchAsset('1', testnet)
        await algorandAssetsAdapter.fetchOnChainAsset('1', testnet)
        await algorandAssetsAdapter.fetchAssetAuthorities('1', testnet)

        expect(mocks.fetchAndPersistAssets).toHaveBeenCalledWith(['1'], testnet)
        expect(mocks.fetchAssetFromApis).toHaveBeenCalledWith('1', testnet)
        expect(mocks.fetchOnChainAsset).toHaveBeenCalledWith('1', 'testnet')
        expect(mocks.fetchAssetAuthorities).toHaveBeenCalledWith('1', 'testnet')
    })

    it('passes the scope network to search and the price sources', async () => {
        mocks.fetchNativeUsdPrice.mockResolvedValue(new Decimal('0.2'))

        await algorandAssetsAdapter.searchAssets(
            { query: 'usdc', cursor: 'C', hasCollectible: true },
            testnet,
        )
        await algorandAssetsAdapter.fetchNativeUsdPrice(testnet)
        await algorandAssetsAdapter.fetchUsdPrices(['1'], testnet)

        expect(mocks.searchAssetPage).toHaveBeenCalledWith({
            query: 'usdc',
            cursor: 'C',
            hasCollectible: true,
            network: 'testnet',
        })
        expect(mocks.fetchNativeUsdPrice).toHaveBeenCalledWith('testnet')
        expect(mocks.fetchUsdPrices).toHaveBeenCalledWith(['1'], 'testnet')
    })

    it('refuses a scope that is not an Algorand network', async () => {
        await expect(
            algorandAssetsAdapter.fetchOnChainAsset('1', foreign),
        ).rejects.toThrow('Not an Algorand scope')
        expect(mocks.fetchOnChainAsset).not.toHaveBeenCalled()
    })
})
