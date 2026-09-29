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

import { describe, expect, it, vi } from 'vitest'
import {
    ChainAdapterNotRegisteredError,
    scopeForLegacyNetwork,
} from '@perawallet/wallet-core-chain-contract'
import {
    assetsAdapterFor,
    assetsChainAdapters,
    fetchAndPersistAssets,
    fetchOnChainAsset,
    nativeAssetFor,
} from '../chain-adapter'
import { fetchAndPersistPrices } from '../sync/price-syncer'
import { FAKE_NATIVE_ASSET, registerFakeAssetsAdapter } from './fakeAssetsChain'

describe('assetsAdapterFor / nativeAssetFor', () => {
    it("resolve a scope's chain to its registered adapter and native asset", () => {
        const adapter = registerFakeAssetsAdapter()

        expect(assetsAdapterFor(scopeForLegacyNetwork('testnet'))).toBe(adapter)
        expect(nativeAssetFor('algorand')).toBe(FAKE_NATIVE_ASSET)
    })
})

describe('network wrappers', () => {
    it('fetchAndPersistAssets hands the adapter the legacy network as a scope', async () => {
        const syncAssets = vi.fn().mockResolvedValue(undefined)
        registerFakeAssetsAdapter({ syncAssets })

        await fetchAndPersistAssets(['1', '2'], 'testnet')

        expect(syncAssets).toHaveBeenCalledWith(['1', '2'], {
            chainId: 'algorand',
            networkId: 'testnet',
        })
    })

    it("fetchOnChainAsset returns the adapter's on-chain record", async () => {
        const fetchOnChain = vi.fn().mockResolvedValue({ assetId: '7' })
        registerFakeAssetsAdapter({ fetchOnChainAsset: fetchOnChain })

        const asset = await fetchOnChainAsset('7', 'mainnet')

        expect(asset).toEqual({ assetId: '7' })
        expect(fetchOnChain).toHaveBeenCalledWith('7', {
            chainId: 'algorand',
            networkId: 'mainnet',
        })
    })
})

describe('with no adapter registered', () => {
    it('names the feature and chain', () => {
        assetsChainAdapters.reset()

        expect(() => nativeAssetFor('algorand')).toThrow(
            'No assets adapter is registered for chain "algorand"',
        )
    })

    it('rejects each wrapper instead of throwing synchronously', async () => {
        assetsChainAdapters.reset()

        await expect(
            fetchAndPersistAssets(['1'], 'mainnet'),
        ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
        await expect(fetchOnChainAsset('1', 'mainnet')).rejects.toBeInstanceOf(
            ChainAdapterNotRegisteredError,
        )
        await expect(
            fetchAndPersistPrices(['1'], 'mainnet'),
        ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
    })
})
