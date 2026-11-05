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
import { queryKeyReferencesScope } from '@perawallet/wallet-core-chain-contract'
import { NETWORK_PARTITIONED_QUERY_MODULES } from '@perawallet/wallet-core-chain-shared'
import {
    MODULE_PREFIX,
    invalidateAccountQueriesForAddresses,
    invalidateAccountQueriesForScope,
    removeAccountQueriesForAddresses,
    getAccountBalancesQueryKey,
    getAccountAssetBalanceHistoryQueryKey,
    getAccountBalancesHistoryQueryKey,
    getAccountCollectiblesQueryKey,
    getAccountFundedNetworksQueryKey,
    getAccountHoldingsPageQueryKey,
    getHoldingAcquisitionOrderQueryKey,
    getAccountSummaryQueryKey,
    getAssetHoldersQueryKey,
    getOnChainAccountStateQueryKey,
    getDelegatedAddressesQueryKey,
    isAccountBalancesHistoryQuery,
} from '../querykeys'

const MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const
const TESTNET = { chainId: 'algorand', networkId: 'testnet' } as const

describe('query keys', () => {
    test.each([
        ['balance', getAccountBalancesQueryKey('ADDR1', MAINNET)],
        ['summary', getAccountSummaryQueryKey('ADDR1', MAINNET)],
        [
            'funded-networks',
            getAccountFundedNetworksQueryKey('ADDR1', 'algorand', MAINNET),
        ],
        [
            'holdings-page',
            getAccountHoldingsPageQueryKey([
                { address: 'ADDR1', scope: MAINNET },
            ]),
        ],
        [
            'collectibles',
            getAccountCollectiblesQueryKey([
                { address: 'ADDR1', scope: MAINNET },
            ]),
        ],
        [
            'balance-history',
            getAccountBalancesHistoryQueryKey(['ADDR1'], 'one-day', MAINNET),
        ],
        [
            'on-chain-account-state',
            getOnChainAccountStateQueryKey('ADDR1', MAINNET),
        ],
        [
            'holding-acquisition-order',
            getHoldingAcquisitionOrderQueryKey('ADDR1', MAINNET),
        ],
        [
            'delegated-addresses',
            getDelegatedAddressesQueryKey('ADDR1', MAINNET),
        ],
        ['asset-holders', getAssetHoldersQueryKey('123', MAINNET)],
        [
            'assets balance-history',
            getAccountAssetBalanceHistoryQueryKey(
                MAINNET,
                'ADDR1',
                '123',
                'one-day',
            ),
        ],
    ])('%s carries the scope, not a bare network', (_, key) => {
        expect(queryKeyReferencesScope(key, MAINNET)).toBe(true)
        expect(queryKeyReferencesScope(key, TESTNET)).toBe(false)
        expect(key.some(part => part === 'mainnet')).toBe(false)
        expect(
            key.some(
                part =>
                    typeof part === 'object' &&
                    part !== null &&
                    'network' in part,
            ),
        ).toBe(false)
    })

    test('the payload holds the scope object alongside the address', () => {
        expect(getAccountSummaryQueryKey('ADDR1', MAINNET)).toEqual([
            MODULE_PREFIX,
            'summary',
            { address: 'ADDR1', scope: MAINNET },
        ])
    })
})

describe('invalidateAccountQueriesForAddresses', () => {
    const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' } as const
    const TWO_SOURCES = [
        { address: 'ADDR1', scope: MAINNET },
        { address: '0xADDR', scope: ETHEREUM },
    ]

    test("leaves an account's asset chart alone when charts are excluded", () => {
        const queryClient = new QueryClient()
        const chart = getAccountAssetBalanceHistoryQueryKey(
            MAINNET,
            'ADDR1',
            '123',
            'one-day',
            'USD',
        )
        const summary = getAccountSummaryQueryKey('ADDR1', MAINNET)
        queryClient.setQueryData(chart, { value: 1 })
        queryClient.setQueryData(summary, { value: 1 })

        invalidateAccountQueriesForAddresses(queryClient, ['ADDR1'], {
            includeCharts: false,
        })

        expect(queryClient.getQueryState(chart)?.isInvalidated).toBe(false)
        expect(queryClient.getQueryState(summary)?.isInvalidated).toBe(true)
    })

    test.each([
        [
            'holdings-page',
            getAccountHoldingsPageQueryKey(TWO_SOURCES, {
                sortMode: 'balanceDesc',
            }),
        ],
        [
            'collectibles',
            getAccountCollectiblesQueryKey(TWO_SOURCES, {
                sortMode: 'titleAsc',
            }),
        ],
    ])(
        'reaches a %s key spanning two sources through either address',
        (_, key) => {
            for (const address of ['ADDR1', '0xADDR']) {
                const queryClient = new QueryClient()
                queryClient.setQueryData(key, [])

                invalidateAccountQueriesForAddresses(queryClient, [address])

                expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
            }
            expect(queryKeyReferencesScope(key, MAINNET)).toBe(true)
            expect(queryKeyReferencesScope(key, ETHEREUM)).toBe(true)
            expect(queryKeyReferencesScope(key, TESTNET)).toBe(false)
        },
    )

    test('leaves multi-account balance-history aggregates alone by default', () => {
        const queryClient = new QueryClient()
        const key = getAccountBalancesHistoryQueryKey(
            ['ADDR1', 'ADDR2'],
            'one-day',
            MAINNET,
        )
        queryClient.setQueryData(key, { value: 1 })

        invalidateAccountQueriesForAddresses(queryClient, ['ADDR1'])

        expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false)
    })

    test('includeMultiAccountKeys invalidates aggregates containing a target address', () => {
        const queryClient = new QueryClient()
        const intersectingKey = getAccountBalancesHistoryQueryKey(
            ['ADDR1', 'ADDR2'],
            'one-day',
            MAINNET,
        )
        const disjointKey = getAccountBalancesHistoryQueryKey(
            ['ADDR3', 'ADDR4'],
            'one-day',
            MAINNET,
        )
        queryClient.setQueryData(intersectingKey, { value: 1 })
        queryClient.setQueryData(disjointKey, { value: 2 })

        invalidateAccountQueriesForAddresses(queryClient, ['ADDR1'], {
            includeMultiAccountKeys: true,
        })

        expect(queryClient.getQueryState(intersectingKey)?.isInvalidated).toBe(
            true,
        )
        expect(queryClient.getQueryState(disjointKey)?.isInvalidated).toBe(
            false,
        )
    })

    test('includeMultiAccountKeys still invalidates single-account keys and spares others', () => {
        const queryClient = new QueryClient()
        const targetKey = getAccountBalancesQueryKey('ADDR1', MAINNET)
        const otherKey = getAccountBalancesQueryKey('ADDR2', MAINNET)
        queryClient.setQueryData(targetKey, { value: 1 })
        queryClient.setQueryData(otherKey, { value: 2 })

        invalidateAccountQueriesForAddresses(queryClient, ['ADDR1'], {
            includeMultiAccountKeys: true,
        })

        expect(queryClient.getQueryState(targetKey)?.isInvalidated).toBe(true)
        expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false)
    })
})

describe('invalidateAccountQueriesForScope', () => {
    const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' } as const
    const isInvalidated = (queryClient: QueryClient, key: unknown[]) =>
        queryClient.getQueryState(key)?.isInvalidated

    test("reloads the network's account queries and no other network's or module's", () => {
        const queryClient = new QueryClient()
        const summary = getAccountSummaryQueryKey('ADDR1', MAINNET)
        const otherNetwork = getAccountSummaryQueryKey('ADDR1', TESTNET)
        const spanning = getAccountHoldingsPageQueryKey([
            { address: 'ADDR1', scope: MAINNET },
            { address: '0xADDR', scope: ETHEREUM },
        ])
        const otherModule = ['assets', 'price', { scope: MAINNET }]
        for (const key of [summary, otherNetwork, spanning, otherModule]) {
            queryClient.setQueryData(key, [])
        }

        invalidateAccountQueriesForScope(queryClient, MAINNET, {
            includeCharts: false,
        })

        expect(isInvalidated(queryClient, summary)).toBe(true)
        expect(isInvalidated(queryClient, spanning)).toBe(true)
        expect(isInvalidated(queryClient, otherNetwork)).toBe(false)
        expect(isInvalidated(queryClient, otherModule)).toBe(false)
    })

    test("reloads the network's charts only when asked", () => {
        const queryClient = new QueryClient()
        const wealth = getAccountBalancesHistoryQueryKey(
            ['ADDR1'],
            'one-day',
            MAINNET,
        )
        const holding = getAccountAssetBalanceHistoryQueryKey(
            MAINNET,
            'ADDR1',
            '31566704',
            'one-day',
            'USD',
        )
        queryClient.setQueryData(wealth, [])
        queryClient.setQueryData(holding, [])

        invalidateAccountQueriesForScope(queryClient, MAINNET, {
            includeCharts: false,
        })

        expect(isInvalidated(queryClient, wealth)).toBe(false)
        expect(isInvalidated(queryClient, holding)).toBe(false)

        invalidateAccountQueriesForScope(queryClient, MAINNET, {
            includeCharts: true,
        })

        expect(isInvalidated(queryClient, wealth)).toBe(true)
        expect(isInvalidated(queryClient, holding)).toBe(true)
    })
})

describe('removeAccountQueriesForAddresses', () => {
    test('evicts only the targeted address queries from the cache', () => {
        const queryClient = new QueryClient()
        queryClient.setQueryData(getAccountBalancesQueryKey('ADDR1', MAINNET), {
            value: 1,
        })
        queryClient.setQueryData(getAccountBalancesQueryKey('ADDR2', MAINNET), {
            value: 2,
        })

        removeAccountQueriesForAddresses(queryClient, ['ADDR1'])

        // ADDR1's entry is gone; ADDR2's survives.
        expect(
            queryClient.getQueryData(
                getAccountBalancesQueryKey('ADDR1', MAINNET),
            ),
        ).toBeUndefined()
        expect(
            queryClient.getQueryData(
                getAccountBalancesQueryKey('ADDR2', MAINNET),
            ),
        ).toEqual({ value: 2 })
    })

    test('evicts the asset balance-history key (account_address, deeper payload index)', () => {
        const queryClient = new QueryClient()
        const key = getAccountAssetBalanceHistoryQueryKey(
            MAINNET,
            'ADDR1',
            '123',
            'one-day',
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
            MAINNET,
        )
        queryClient.setQueryData(key, { value: 1 })

        removeAccountQueriesForAddresses(queryClient, ['ADDR1'])

        expect(queryClient.getQueryData(key)).toEqual({ value: 1 })
    })

    test('is a no-op for an empty address list', () => {
        const queryClient = new QueryClient()
        queryClient.setQueryData(getAccountBalancesQueryKey('ADDR1', MAINNET), {
            value: 1,
        })

        removeAccountQueriesForAddresses(queryClient, [])

        expect(
            queryClient.getQueryData(
                getAccountBalancesQueryKey('ADDR1', MAINNET),
            ),
        ).toEqual({ value: 1 })
    })
})

describe('isAccountBalancesHistoryQuery', () => {
    test('matches the wealth balance-history key', () => {
        const key = getAccountBalancesHistoryQueryKey(
            ['ADDR1'],
            'one-week',
            MAINNET,
        )

        expect(isAccountBalancesHistoryQuery(key)).toBe(true)
    })

    test('rejects the per-account asset balance-history key and other account keys', () => {
        // ['accounts','assets','balance-history',…] must NOT match — the
        // ticket allowlists only the aggregate wealth key.
        expect(
            isAccountBalancesHistoryQuery(
                getAccountAssetBalanceHistoryQueryKey(
                    MAINNET,
                    'ADDR1',
                    '123',
                    'one-day',
                ),
            ),
        ).toBe(false)
        expect(
            isAccountBalancesHistoryQuery(
                getAccountBalancesQueryKey('ADDR1', MAINNET),
            ),
        ).toBe(false)
    })
})

describe('NETWORK_PARTITIONED_QUERY_MODULES (chain-shared)', () => {
    test('includes this package MODULE_PREFIX, so clearCustomNetworkCache sweeps its custom-network entries', () => {
        // chain-shared/clearCustomNetworkCache.ts duplicates this package's
        // MODULE_PREFIX rather than importing it (importing back would cycle
        // — accounts depends on chain-shared). This test is the drift guard:
        // if MODULE_PREFIX is ever renamed here, this fails in this package,
        // where the rename is happening, instead of silently going stale on
        // the chain-shared side.
        expect(NETWORK_PARTITIONED_QUERY_MODULES.has(MODULE_PREFIX)).toBe(true)
    })
})
