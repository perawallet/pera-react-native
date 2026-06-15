/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    getOwnedAssetIdsQueryKey,
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
