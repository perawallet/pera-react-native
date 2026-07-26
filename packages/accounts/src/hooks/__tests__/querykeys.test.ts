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

import { describe, test, expect } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
    removeAccountQueriesForAddresses,
    getAccountBalancesQueryKey,
    getAccountAssetBalanceHistoryQueryKey,
    getAccountBalancesHistoryQueryKey,
    getOwnedAssetIdsQueryKey,
    isAccountBalancesHistoryQuery,
} from '../querykeys'

describe('removeAccountQueriesForAddresses', () => {
    test('evicts only the targeted address queries from the cache', () => {
        const queryClient = new QueryClient()
        queryClient.setQueryData(
            getAccountBalancesQueryKey('ADDR1', 'mainnet'),
            { value: 1 },
        )
        queryClient.setQueryData(
            getAccountBalancesQueryKey('ADDR2', 'mainnet'),
            { value: 2 },
        )

        removeAccountQueriesForAddresses(queryClient, ['ADDR1'])

        // ADDR1's entry is gone; ADDR2's survives.
        expect(
            queryClient.getQueryData(
                getAccountBalancesQueryKey('ADDR1', 'mainnet'),
            ),
        ).toBeUndefined()
        expect(
            queryClient.getQueryData(
                getAccountBalancesQueryKey('ADDR2', 'mainnet'),
            ),
        ).toEqual({ value: 2 })
    })

    test('evicts the asset balance-history key (account_address, deeper payload index)', () => {
        const queryClient = new QueryClient()
        const key = getAccountAssetBalanceHistoryQueryKey(
            'mainnet',
            'ADDR1',
            '123',
            'one-day',
            'USD',
        )
        queryClient.setQueryData(key, { value: 1 })

        removeAccountQueriesForAddresses(queryClient, ['ADDR1'])

        expect(queryClient.getQueryData(key)).toBeUndefined()
    })

    test('evicts a key carrying the address as a bare path segment', () => {
        const queryClient = new QueryClient()
        const key = ['accounts', 'some-future-key', 'ADDR1']
        queryClient.setQueryData(key, { value: 1 })

        removeAccountQueriesForAddresses(queryClient, ['ADDR1'])

        expect(queryClient.getQueryData(key)).toBeUndefined()
    })

    test('leaves multi-account balance-history aggregates intact', () => {
        const queryClient = new QueryClient()
        const key = getAccountBalancesHistoryQueryKey(
            ['ADDR1', 'ADDR2'],
            'one-day',
            'mainnet',
        )
        queryClient.setQueryData(key, { value: 1 })

        removeAccountQueriesForAddresses(queryClient, ['ADDR1'])

        expect(queryClient.getQueryData(key)).toEqual({ value: 1 })
    })

    test('leaves network-scoped owned-asset-ids intact (search still works)', () => {
        const queryClient = new QueryClient()
        queryClient.setQueryData(getOwnedAssetIdsQueryKey('mainnet'), [
            '1',
            '2',
        ])

        removeAccountQueriesForAddresses(queryClient, ['ADDR1'])

        expect(
            queryClient.getQueryData(getOwnedAssetIdsQueryKey('mainnet')),
        ).toEqual(['1', '2'])
    })

    test('is a no-op for an empty address list', () => {
        const queryClient = new QueryClient()
        queryClient.setQueryData(
            getAccountBalancesQueryKey('ADDR1', 'mainnet'),
            { value: 1 },
        )

        removeAccountQueriesForAddresses(queryClient, [])

        expect(
            queryClient.getQueryData(
                getAccountBalancesQueryKey('ADDR1', 'mainnet'),
            ),
        ).toEqual({ value: 1 })
    })
})

describe('isAccountBalancesHistoryQuery', () => {
    test('matches the wealth balance-history key', () => {
        const key = getAccountBalancesHistoryQueryKey(
            ['ADDR1'],
            'one-week',
            'mainnet',
        )

        expect(isAccountBalancesHistoryQuery(key)).toBe(true)
    })

    test('rejects the per-account asset balance-history key and other account keys', () => {
        // ['accounts','assets','balance-history',…] must NOT match — the
        // ticket allowlists only the aggregate wealth key.
        expect(
            isAccountBalancesHistoryQuery(
                getAccountAssetBalanceHistoryQueryKey(
                    'mainnet',
                    'ADDR1',
                    '123',
                    'one-day',
                    'USD',
                ),
            ),
        ).toBe(false)
        expect(
            isAccountBalancesHistoryQuery(
                getAccountBalancesQueryKey('ADDR1', 'mainnet'),
            ),
        ).toBe(false)
    })
})
