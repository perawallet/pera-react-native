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
} from '../querykeys'

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
