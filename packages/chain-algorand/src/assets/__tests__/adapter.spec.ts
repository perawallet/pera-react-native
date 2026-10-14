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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

const mocks = vi.hoisted(() => ({
    fetchAndPersistAssets: vi.fn(),
    fetchAssetFromApis: vi.fn(),
    fetchOnChainAsset: vi.fn(),
    fetchAssetAuthorities: vi.fn(),
    searchAssetPage: vi.fn(),
    fetchPeraUsdPrices: vi.fn(),
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
vi.mock('../../pricing/provider', () => ({
    fetchPeraUsdPrices: mocks.fetchPeraUsdPrices,
}))

import { algorandAssetsAdapter } from '../adapter'
import { ALGORAND_NATIVE_ASSET } from '../native-asset'

const testnet: ChainScope = { chainId: 'algorand', networkId: 'testnet' }
const ref = { chainId: 'algorand', assetId: '1' } as const
const nativeRef = { chainId: 'algorand', assetId: '0' } as const
const ethereumRef = { chainId: 'ethereum', assetId: '0xabc' } as const
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

    it('passes the unwrapped id, and the scope or its network, to the asset sources', async () => {
        await algorandAssetsAdapter.syncAssets([ref], testnet)
        await algorandAssetsAdapter.getAssetMetadata(ref, testnet)
        await algorandAssetsAdapter.fetchOnChainAsset(ref, testnet)
        await algorandAssetsAdapter.fetchAssetAuthorities!(ref, testnet)

        expect(mocks.fetchAndPersistAssets).toHaveBeenCalledWith(['1'], testnet)
        expect(mocks.fetchAssetFromApis).toHaveBeenCalledWith('1', testnet)
        expect(mocks.fetchOnChainAsset).toHaveBeenCalledWith('1', 'testnet')
        expect(mocks.fetchAssetAuthorities).toHaveBeenCalledWith('1', 'testnet')
    })

    it('answers the native ref from the seeded asset without a request', async () => {
        const asset = await algorandAssetsAdapter.getAssetMetadata(
            nativeRef,
            testnet,
        )

        expect(asset).toBe(ALGORAND_NATIVE_ASSET)
        expect(mocks.fetchAssetFromApis).not.toHaveBeenCalled()
    })

    it('passes the scope network to search and the price sources', async () => {
        await algorandAssetsAdapter.search!(
            { query: 'usdc', cursor: 'C', hasCollectible: true },
            testnet,
        )
        await algorandAssetsAdapter.getPrices([ref], testnet)

        expect(mocks.searchAssetPage).toHaveBeenCalledWith({
            query: 'usdc',
            cursor: 'C',
            hasCollectible: true,
            network: 'testnet',
        })
        expect(mocks.fetchPeraUsdPrices).toHaveBeenCalledWith([ref], 'testnet')
    })

    it('refuses a scope that is not an Algorand network', async () => {
        await expect(
            algorandAssetsAdapter.fetchOnChainAsset(ref, foreign),
        ).rejects.toThrow('Not an Algorand scope')
        await expect(
            algorandAssetsAdapter.getAssetMetadata(nativeRef, foreign),
        ).rejects.toThrow('Not an Algorand scope')
        await expect(
            algorandAssetsAdapter.search!({ query: 'x' }, foreign),
        ).rejects.toThrow('Not an Algorand scope')
        await expect(
            algorandAssetsAdapter.getPrices([ref], foreign),
        ).rejects.toThrow('Not an Algorand scope')
        expect(mocks.fetchOnChainAsset).not.toHaveBeenCalled()
        expect(mocks.searchAssetPage).not.toHaveBeenCalled()
        expect(mocks.fetchPeraUsdPrices).not.toHaveBeenCalled()
    })

    it('refuses a ref on another chain before any request', async () => {
        const adapter = algorandAssetsAdapter

        await expect(
            adapter.syncAssets([ref, ethereumRef], testnet),
        ).rejects.toThrow('Not an Algorand asset')
        await expect(
            adapter.getAssetMetadata(ethereumRef, testnet),
        ).rejects.toThrow('Not an Algorand asset')
        await expect(
            adapter.fetchOnChainAsset(ethereumRef, testnet),
        ).rejects.toThrow('Not an Algorand asset')
        await expect(
            adapter.fetchAssetAuthorities!(ethereumRef, testnet),
        ).rejects.toThrow('Not an Algorand asset')

        expect(mocks.fetchAndPersistAssets).not.toHaveBeenCalled()
        expect(mocks.fetchAssetFromApis).not.toHaveBeenCalled()
        expect(mocks.fetchOnChainAsset).not.toHaveBeenCalled()
        expect(mocks.fetchAssetAuthorities).not.toHaveBeenCalled()
    })
})
