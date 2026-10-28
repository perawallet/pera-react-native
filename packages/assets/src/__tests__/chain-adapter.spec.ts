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
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import {
    AssetSearchUnsupportedError,
    assetsAdapterFor,
    assetsChainAdapters,
    displayCurrencyToAssetId,
    fetchAndPersistAssets,
    fetchAssetAuthorities,
    fetchAssetMetadata,
    fetchOnChainAsset,
    findNativeAsset,
    isNativeAssetId,
    nativeAssetFor,
    searchAssets,
    searchAssetsAcrossScopes,
    type AssetsChainAdapter,
} from '../chain-adapter'
import type { DisplayableAsset } from '../models'
import { fetchAndPersistPrices } from '../sync/price-syncer'
import {
    FAKE_NATIVE_ASSET,
    fakeAssetsAdapter,
    registerFakeAssetsAdapter,
} from './fakeAssetsChain'

describe('assetsAdapterFor / nativeAssetFor', () => {
    it("resolve a scope's chain to its registered adapter and native asset", () => {
        const adapter = registerFakeAssetsAdapter()

        expect(
            assetsAdapterFor({
                chainId: LEGACY_CHAIN_ID,
                networkId: 'testnet',
            } as const),
        ).toBe(adapter)
        expect(nativeAssetFor('algorand')).toBe(FAKE_NATIVE_ASSET)
        expect(findNativeAsset('algorand')).toBe(FAKE_NATIVE_ASSET)
    })

    it('isNativeAssetId matches only the registered chain native id', () => {
        registerFakeAssetsAdapter()

        expect(isNativeAssetId('algorand', FAKE_NATIVE_ASSET.assetId)).toBe(
            true,
        )
        expect(isNativeAssetId('algorand', '31566704')).toBe(false)
    })

    it('displayCurrencyToAssetId maps only the exact ALGO ticker to the native id', () => {
        registerFakeAssetsAdapter()

        expect(displayCurrencyToAssetId('ALGO', 'algorand')).toBe(
            FAKE_NATIVE_ASSET.assetId,
        )
        expect(displayCurrencyToAssetId('USD', 'algorand')).toBeNull()
        expect(displayCurrencyToAssetId('algo', 'algorand')).toBeNull()
    })
})

describe('scope wrappers', () => {
    it('fetchAndPersistAssets hands the adapter refs on the scope it was given', async () => {
        const syncAssets = vi.fn().mockResolvedValue(undefined)
        registerFakeAssetsAdapter({ syncAssets })

        await fetchAndPersistAssets(['1', '2'], {
            chainId: LEGACY_CHAIN_ID,
            networkId: 'testnet',
        } as const)

        expect(syncAssets).toHaveBeenCalledWith(
            [
                { chainId: 'algorand', assetId: '1' },
                { chainId: 'algorand', assetId: '2' },
            ],
            { chainId: 'algorand', networkId: 'testnet' },
        )
    })

    it('fetchAssetMetadata returns the metadata the adapter resolves for the ref', async () => {
        const getAssetMetadata = vi.fn().mockResolvedValue({ assetId: '7' })
        registerFakeAssetsAdapter({ getAssetMetadata })

        const asset = await fetchAssetMetadata('7', {
            chainId: LEGACY_CHAIN_ID,
            networkId: 'mainnet',
        } as const)

        expect(asset).toEqual({ assetId: '7' })
        expect(getAssetMetadata).toHaveBeenCalledWith(
            { chainId: 'algorand', assetId: '7' },
            { chainId: 'algorand', networkId: 'mainnet' },
        )
    })

    it('fetchAssetAuthorities hands the adapter a ref and returns its answer', async () => {
        const authorities = {
            hasFreeze: true,
            hasClawback: false,
            freezeAddress: 'FREEZE',
            clawbackAddress: null,
        }
        const member = vi.fn().mockResolvedValue(authorities)
        registerFakeAssetsAdapter({ fetchAssetAuthorities: member })

        const result = await fetchAssetAuthorities('7', {
            chainId: LEGACY_CHAIN_ID,
            networkId: 'mainnet',
        } as const)

        expect(result).toEqual(authorities)
        expect(member).toHaveBeenCalledWith(
            { chainId: 'algorand', assetId: '7' },
            { chainId: 'algorand', networkId: 'mainnet' },
        )
    })

    it('fetchAssetAuthorities resolves to no authority on a chain that declares none', async () => {
        registerFakeAssetsAdapter({ fetchAssetAuthorities: undefined })

        await expect(
            fetchAssetAuthorities('7', {
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        ).resolves.toEqual({
            hasFreeze: false,
            hasClawback: false,
            freezeAddress: null,
            clawbackAddress: null,
        })
    })

    it('searchAssets passes the params and scope through', async () => {
        const page = { results: [], nextCursor: 'C2' }
        const search = vi.fn().mockResolvedValue(page)
        registerFakeAssetsAdapter({ search })

        const result = await searchAssets({ query: 'usdc', cursor: 'C1' }, {
            chainId: LEGACY_CHAIN_ID,
            networkId: 'mainnet',
        } as const)

        expect(result).toBe(page)
        expect(search).toHaveBeenCalledWith(
            { query: 'usdc', cursor: 'C1' },
            { chainId: 'algorand', networkId: 'mainnet' },
        )
    })

    it('searchAssets rejects with AssetSearchUnsupportedError on a chain that declares no search', async () => {
        registerFakeAssetsAdapter({ search: undefined })

        const rejection = searchAssets({ query: 'usdc' }, {
            chainId: LEGACY_CHAIN_ID,
            networkId: 'mainnet',
        } as const)

        await expect(rejection).rejects.toBeInstanceOf(
            AssetSearchUnsupportedError,
        )
        await expect(rejection).rejects.toMatchObject({ chainId: 'algorand' })
    })

    it("fetchOnChainAsset returns the adapter's on-chain record", async () => {
        const fetchOnChain = vi.fn().mockResolvedValue({ assetId: '7' })
        registerFakeAssetsAdapter({ fetchOnChainAsset: fetchOnChain })

        const asset = await fetchOnChainAsset('7', {
            chainId: LEGACY_CHAIN_ID,
            networkId: 'mainnet',
        } as const)

        expect(asset).toEqual({ assetId: '7' })
        expect(fetchOnChain).toHaveBeenCalledWith(
            { chainId: 'algorand', assetId: '7' },
            { chainId: 'algorand', networkId: 'mainnet' },
        )
    })
})

describe('searchAssetsAcrossScopes', () => {
    const ALGORAND = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const
    const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' } as const
    const asset = (assetId: string): DisplayableAsset => ({ assetId })
    const registerBoth = (
        algorandSearch: AssetsChainAdapter['search'],
        ethereumSearch: AssetsChainAdapter['search'],
    ) => {
        registerFakeAssetsAdapter({ search: algorandSearch })
        assetsChainAdapters.register(
            fakeAssetsAdapter({
                chainId: 'ethereum' as ChainId,
                search: ethereumSearch,
            }),
        )
    }

    it('searches every scope from its start and keeps each hit with its scope, in scope order', async () => {
        const algorandSearch = vi
            .fn()
            .mockResolvedValue({ results: [asset('1')], nextCursor: 'A2' })
        const ethereumSearch = vi.fn().mockResolvedValue({
            results: [asset('native')],
            nextCursor: undefined,
        })
        registerBoth(algorandSearch, ethereumSearch)

        const page = await searchAssetsAcrossScopes(
            { query: 'usd', hasCollectible: false },
            [ALGORAND, ETHEREUM],
        )

        expect(page).toEqual({
            results: [
                { scope: ALGORAND, asset: asset('1') },
                { scope: ETHEREUM, asset: asset('native') },
            ],
            nextCursors: ['A2', null],
        })
        expect(algorandSearch).toHaveBeenCalledWith(
            { query: 'usd', cursor: undefined, hasCollectible: false },
            ALGORAND,
        )
        expect(ethereumSearch).toHaveBeenCalledWith(
            { query: 'usd', cursor: undefined, hasCollectible: false },
            ETHEREUM,
        )
    })

    it('continues only the scopes that have more, and ends once none has', async () => {
        const algorandSearch = vi
            .fn()
            .mockResolvedValue({ results: [asset('2')], nextCursor: undefined })
        const ethereumSearch = vi.fn()
        registerBoth(algorandSearch, ethereumSearch)

        const page = await searchAssetsAcrossScopes(
            { query: 'usd', cursors: ['A2', null] },
            [ALGORAND, ETHEREUM],
        )

        expect(page).toEqual({
            results: [{ scope: ALGORAND, asset: asset('2') }],
            nextCursors: undefined,
        })
        expect(algorandSearch).toHaveBeenCalledWith(
            { query: 'usd', cursor: 'A2', hasCollectible: undefined },
            ALGORAND,
        )
        expect(ethereumSearch).not.toHaveBeenCalled()
    })

    it("keeps the other scopes' hits when one fails, and stops searching the failed one", async () => {
        registerBoth(
            vi.fn().mockRejectedValue(new Error('down')),
            vi.fn().mockResolvedValue({
                results: [asset('native')],
                nextCursor: 'E2',
            }),
        )

        const page = await searchAssetsAcrossScopes({ query: '' }, [
            ALGORAND,
            ETHEREUM,
        ])

        expect(page).toEqual({
            results: [{ scope: ETHEREUM, asset: asset('native') }],
            nextCursors: [null, 'E2'],
        })
    })

    it('rejects with the first failure when every scope fails', async () => {
        const failure = new Error('algorand down')
        registerBoth(
            vi.fn().mockRejectedValue(failure),
            vi.fn().mockRejectedValue(new Error('ethereum down')),
        )

        await expect(
            searchAssetsAcrossScopes({ query: '' }, [ALGORAND, ETHEREUM]),
        ).rejects.toBe(failure)
    })

    it('rejects with the failure when the scopes that answered found nothing', async () => {
        const failure = new Error('algorand down')
        registerBoth(
            vi.fn().mockRejectedValue(failure),
            vi.fn().mockResolvedValue({ results: [], nextCursor: undefined }),
        )

        await expect(
            searchAssetsAcrossScopes({ query: 'usd' }, [ALGORAND, ETHEREUM]),
        ).rejects.toBe(failure)
    })

    describe('a chain the backend has not switched on', () => {
        const refusal = () =>
            new PeraNetworkError('client', {
                status: 422,
                backendCode: 'chain_not_enabled',
            })

        it('finds nothing, rather than failing, while another scope answered', async () => {
            registerBoth(
                vi.fn().mockResolvedValue({
                    results: [],
                    nextCursor: undefined,
                }),
                vi.fn().mockRejectedValue(refusal()),
            )

            await expect(
                searchAssetsAcrossScopes({ query: 'zzz' }, [
                    ALGORAND,
                    ETHEREUM,
                ]),
            ).resolves.toEqual({ results: [], nextCursors: undefined })
        })

        it('rejects with the refusal when no scope answered', async () => {
            const first = refusal()
            registerBoth(
                vi.fn().mockRejectedValue(first),
                vi.fn().mockRejectedValue(refusal()),
            )

            await expect(
                searchAssetsAcrossScopes({ query: '' }, [ALGORAND, ETHEREUM]),
            ).rejects.toBe(first)
        })

        it('gives way to another failure', async () => {
            const failure = new Error('ethereum down')
            registerBoth(
                vi.fn().mockRejectedValue(refusal()),
                vi.fn().mockRejectedValue(failure),
            )

            await expect(
                searchAssetsAcrossScopes({ query: '' }, [ALGORAND, ETHEREUM]),
            ).rejects.toBe(failure)
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

    it('finds no native asset rather than throwing', () => {
        assetsChainAdapters.reset()

        expect(findNativeAsset('algorand')).toBeUndefined()
    })

    it('rejects each wrapper instead of throwing synchronously', async () => {
        assetsChainAdapters.reset()

        await expect(
            fetchAndPersistAssets(['1'], {
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
        await expect(
            fetchOnChainAsset('1', {
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
        await expect(
            fetchAssetMetadata('1', {
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
        await expect(
            fetchAssetAuthorities('1', {
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
        await expect(
            searchAssets({ query: 'a' }, {
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
        await expect(
            fetchAndPersistPrices(['1'], {
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
    })
})
