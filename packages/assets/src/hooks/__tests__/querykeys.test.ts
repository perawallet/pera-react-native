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

import { describe, test, expect, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

// This package's vitest.setup.ts mocks @perawallet/wallet-extension-platform-driver
// but not @perawallet/wallet-extension-provider, so importing the real (unmocked)
// blockchain module below — needed to test against the real
// NETWORK_PARTITIONED_QUERY_MODULES rather than a fabricated one — would otherwise
// reach getProvider()'s real implementation and fail resolving react-native-mmkv
// (a native module vitest can't load). Scoped to this file rather than the shared
// setup: nothing else in this package's suite imports raw blockchain code.
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

import { NETWORK_PARTITIONED_QUERY_MODULES } from '@perawallet/wallet-core-blockchain'
import {
    MODULE_PREFIX,
    isAssetQuery,
    invalidateAssetQueries,
    getAssetPricesQueryKey,
    getAssetPriceHistoryQueryKey,
    getAssetDetailsQueryKey,
    getPublicAssetDetailsQueryKey,
    getIndexerAssetDetailsQueryKey,
    isAssetPriceHistoryQuery,
    getAssetsQueryKey,
    hashAssetIds,
} from '../querykeys'

describe('hashAssetIds', () => {
    test('is stable for the same list', () => {
        expect(hashAssetIds(['1', '2', '3'])).toBe(
            hashAssetIds(['1', '2', '3']),
        )
    })

    test('distinguishes different ids', () => {
        expect(hashAssetIds(['1', '2'])).not.toBe(hashAssetIds(['1', '3']))
    })

    test('distinguishes reordered ids', () => {
        expect(hashAssetIds(['1', '2'])).not.toBe(hashAssetIds(['2', '1']))
    })

    test('distinguishes lists that concatenate alike', () => {
        expect(hashAssetIds(['1', '23'])).not.toBe(hashAssetIds(['12', '3']))
    })

    test('distinguishes a subset from its superset', () => {
        expect(hashAssetIds(['1', '2'])).not.toBe(hashAssetIds(['1', '2', '3']))
    })

    test('is fixed width regardless of list size', () => {
        const many = Array.from({ length: 20_000 }, (_, i) => String(i))

        expect(hashAssetIds(many).length).toBeLessThan(32)
    })

    test('does not collide across a large sweep of realistic id lists', () => {
        const digests = new Set<string>()
        for (let start = 0; start < 2000; start++) {
            digests.add(
                hashAssetIds(
                    Array.from({ length: 50 }, (_, i) => String(start + i)),
                ),
            )
        }

        expect(digests.size).toBe(2000)
    })
})

describe('getAssetsQueryKey', () => {
    test('keeps the ids out of the key so hashing it stays O(1)', () => {
        const key = getAssetsQueryKey(
            Array.from({ length: 20_000 }, (_, i) => String(i)),
            'mainnet',
        )

        expect(JSON.stringify(key).length).toBeLessThan(100)
    })

    test('is derivable from the ids alone, so cache seeding still matches', () => {
        expect(getAssetsQueryKey(['123'], 'mainnet')).toEqual(
            getAssetsQueryKey(['123'], 'mainnet'),
        )
        expect(getAssetsQueryKey(['123'], 'mainnet')).not.toEqual(
            getAssetsQueryKey(['456'], 'mainnet'),
        )
    })

    test('partitions by network', () => {
        expect(getAssetsQueryKey(['123'], 'mainnet')).not.toEqual(
            getAssetsQueryKey(['123'], 'testnet'),
        )
    })
})

describe('isAssetQuery', () => {
    test('returns true for any key whose first element is the module prefix', () => {
        expect(isAssetQuery([MODULE_PREFIX, 'prices', 'usd'])).toBe(true)
        expect(isAssetQuery(getAssetPricesQueryKey(['123'], 'mainnet'))).toBe(
            true,
        )
    })

    test('returns false for keys from other modules', () => {
        expect(isAssetQuery(['accounts', '123'])).toBe(false)
        expect(isAssetQuery([])).toBe(false)
    })
})

describe('invalidateAssetQueries', () => {
    test('invalidates only queries whose key begins with the module prefix', () => {
        const queryClient = new QueryClient()
        const spy = vi.spyOn(queryClient, 'invalidateQueries')

        invalidateAssetQueries(queryClient)

        expect(spy).toHaveBeenCalledWith({
            predicate: expect.any(Function),
        })

        const predicate = spy.mock.calls[0][0]!.predicate!
        expect(predicate({ queryKey: [MODULE_PREFIX, 'x'] } as never)).toBe(
            true,
        )
        expect(predicate({ queryKey: ['accounts'] } as never)).toBe(false)
    })
})

describe('detail query keys', () => {
    test('getAssetDetailsQueryKey includes id, useDB flag, and network', () => {
        expect(getAssetDetailsQueryKey('123', true, 'mainnet')).toEqual([
            MODULE_PREFIX,
            { assetId: '123', useDB: true, network: 'mainnet' },
        ])
    })

    test('getPublicAssetDetailsQueryKey includes the public namespace', () => {
        expect(getPublicAssetDetailsQueryKey('123')).toEqual([
            MODULE_PREFIX,
            'public',
            { assetId: '123' },
        ])
    })

    test('getIndexerAssetDetailsQueryKey includes the indexer namespace', () => {
        expect(getIndexerAssetDetailsQueryKey('123')).toEqual([
            MODULE_PREFIX,
            'indexer',
            { assetId: '123' },
        ])
    })

    test('getAssetPriceHistoryQueryKey includes asset id, period, and network', () => {
        expect(getAssetPriceHistoryQueryKey('123', '7d', 'mainnet')).toEqual([
            MODULE_PREFIX,
            'prices',
            'history',
            { assetID: '123', period: '7d', network: 'mainnet' },
        ])
    })
})

describe('isAssetPriceHistoryQuery', () => {
    test('matches the asset price-history key', () => {
        const key = getAssetPriceHistoryQueryKey('123', 'one-week', 'mainnet')

        expect(isAssetPriceHistoryQuery(key)).toBe(true)
    })

    test('rejects the sibling prices key and other asset keys', () => {
        // ['assets','prices','usd',…] shares two segments — the third must gate it.
        expect(
            isAssetPriceHistoryQuery(
                getAssetPricesQueryKey(['123'], 'mainnet'),
            ),
        ).toBe(false)
        expect(
            isAssetPriceHistoryQuery(getAssetsQueryKey(['123'], 'mainnet')),
        ).toBe(false)
        expect(isAssetPriceHistoryQuery(['accounts', 'balance-history'])).toBe(
            false,
        )
    })
})

describe('NETWORK_PARTITIONED_QUERY_MODULES (blockchain)', () => {
    test('includes this package MODULE_PREFIX, so clearCustomNetworkCache sweeps its custom-network entries', () => {
        // blockchain/clearCustomNetworkCache.ts duplicates this package's
        // MODULE_PREFIX rather than importing it (importing back would cycle
        // — assets depends on blockchain). This test is the drift guard: if
        // MODULE_PREFIX is ever renamed here, this fails in this package,
        // where the rename is happening, instead of silently going stale on
        // the blockchain side.
        expect(NETWORK_PARTITIONED_QUERY_MODULES.has(MODULE_PREFIX)).toBe(true)
    })
})
