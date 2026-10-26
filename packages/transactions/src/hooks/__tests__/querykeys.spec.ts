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

// This package's vitest.setup.ts mocks @perawallet/wallet-extension-platform-driver
// but not @perawallet/wallet-extension-provider, so importing the real (unmocked)
// chain-shared module below — needed to test against the real
// NETWORK_PARTITIONED_QUERY_MODULES rather than a fabricated one — would otherwise
// reach getProvider()'s real implementation and fail resolving react-native-mmkv
// (a native module vitest can't load). Scoped to this file rather than the shared
// setup: nothing else in this package's suite imports raw chain-shared code.
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

import { QueryClient } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import {
    type AssetRef,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { NETWORK_PARTITIONED_QUERY_MODULES } from '@perawallet/wallet-core-chain-shared'
import {
    MODULE_PREFIX,
    getAssetInboxRequestsQueryKey,
    getAssetInboxSendSummaryQueryKey,
    isAssetInboxQuery,
    transactionQueryKeys,
    invalidateTransactionQueriesForAddresses,
    invalidateTransactionQueriesForScope,
} from '../querykeys'

const MAINNET = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const
const TESTNET = { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const
const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' } as const
const BASE = { chainId: 'base', networkId: 'mainnet' } as const
const ALGO: AssetRef = { chainId: MAINNET.chainId, assetId: '0' }

describe('transactionQueryKeys', () => {
    describe('all', () => {
        test('returns the module prefix', () => {
            expect(transactionQueryKeys.all).toEqual(['transactions'])
        })
    })

    describe('history', () => {
        test('carries the account address and the scope object', () => {
            const key = transactionQueryKeys.history('ADDR123', MAINNET)

            expect(key).toEqual([
                'transactions',
                'history',
                { accountAddress: 'ADDR123', scope: MAINNET },
            ])
        })

        test('produces different keys for different scopes', () => {
            const mainnetKey = transactionQueryKeys.history('ADDR123', MAINNET)
            const testnetKey = transactionQueryKeys.history('ADDR123', TESTNET)

            expect(mainnetKey).not.toEqual(testnetKey)
        })

        test('produces different keys for different addresses', () => {
            const key1 = transactionQueryKeys.history('ADDR1', MAINNET)
            const key2 = transactionQueryKeys.history('ADDR2', MAINNET)

            expect(key1).not.toEqual(key2)
        })
    })

    describe('historyWithFilters', () => {
        test('includes account address, scope, and filters', () => {
            const key = transactionQueryKeys.historyWithFilters(
                'ADDR123',
                MAINNET,
                {
                    assetId: '456',
                    limit: 25,
                },
            )

            expect(key).toEqual([
                'transactions',
                'history',
                {
                    accountAddress: 'ADDR123',
                    scope: MAINNET,
                    assetId: '456',
                    limit: 25,
                },
            ])
        })

        test('produces different keys for different scopes', () => {
            const filters = { assetId: '456' }
            const mainnetKey = transactionQueryKeys.historyWithFilters(
                'ADDR123',
                MAINNET,
                filters,
            )
            const testnetKey = transactionQueryKeys.historyWithFilters(
                'ADDR123',
                TESTNET,
                filters,
            )

            expect(mainnetKey).not.toEqual(testnetKey)
        })

        test('produces different keys for different filters', () => {
            const key1 = transactionQueryKeys.historyWithFilters(
                'ADDR123',
                MAINNET,
                { assetId: '100' },
            )
            const key2 = transactionQueryKeys.historyWithFilters(
                'ADDR123',
                MAINNET,
                { assetId: '200' },
            )

            expect(key1).not.toEqual(key2)
        })
    })

    describe('paginatedHistory', () => {
        test('includes account address, scope, and url', () => {
            const key = transactionQueryKeys.paginatedHistory(
                'ADDR123',
                MAINNET,
                'https://api.example.com/next',
            )

            expect(key).toEqual([
                'transactions',
                'history',
                'page',
                {
                    accountAddress: 'ADDR123',
                    scope: MAINNET,
                    url: 'https://api.example.com/next',
                },
            ])
        })

        test('produces different keys for different scopes', () => {
            const url = 'https://api.example.com/next'
            const mainnetKey = transactionQueryKeys.paginatedHistory(
                'ADDR123',
                MAINNET,
                url,
            )
            const testnetKey = transactionQueryKeys.paginatedHistory(
                'ADDR123',
                TESTNET,
                url,
            )

            expect(mainnetKey).not.toEqual(testnetKey)
        })
    })

    describe('spendableBalance', () => {
        test('carries the base-unit fee as plain text', () => {
            const key = transactionQueryKeys.spendableBalance(
                'ADDR123',
                ALGO,
                MAINNET,
                new Decimal(1000),
            )

            expect(key).toEqual([
                'transactions',
                'spendable-balance',
                {
                    accountAddress: 'ADDR123',
                    asset: ALGO,
                    scope: MAINNET,
                    fee: '1000',
                },
            ])
        })

        test('never writes the fee in exponent form', () => {
            const key = transactionQueryKeys.spendableBalance(
                'ADDR123',
                ALGO,
                MAINNET,
                new Decimal('1e21'),
            )

            expect(key[2].fee).toBe('1000000000000000000000')
        })
    })

    describe('addressPoisoning', () => {
        test('keys on the recipient and scope', () => {
            expect(
                transactionQueryKeys.addressPoisoning('RECEIVER', MAINNET),
            ).toEqual([
                'transactions',
                'address-poisoning',
                { recipient: 'RECEIVER', scope: MAINNET },
            ])
        })
    })

    describe('recipientWarning', () => {
        test('carries the base-unit amount as plain text', () => {
            const key = transactionQueryKeys.recipientWarning(
                'RECEIVER',
                ALGO,
                MAINNET,
                new Decimal(50_000),
            )

            expect(key).toEqual([
                'transactions',
                'recipient-warning',
                {
                    recipient: 'RECEIVER',
                    asset: ALGO,
                    scope: MAINNET,
                    amount: '50000',
                },
            ])
        })

        test('never writes the amount in exponent form', () => {
            const key = transactionQueryKeys.recipientWarning(
                'RECEIVER',
                ALGO,
                MAINNET,
                new Decimal('1e21'),
            )

            expect(key[2].amount).toBe('1000000000000000000000')
        })
    })
})

describe('invalidateTransactionQueriesForScope', () => {
    test("invalidates that scope's queries and leaves other chains and networks alone", () => {
        const queryClient = new QueryClient()
        const algorandKey = transactionQueryKeys.history('ADDR1', MAINNET)
        const testnetKey = transactionQueryKeys.history('ADDR1', TESTNET)
        const ethereumKey = transactionQueryKeys.records('0xabc', ETHEREUM, {})
        for (const key of [algorandKey, testnetKey, ethereumKey]) {
            queryClient.setQueryData(key, { value: 1 })
        }

        invalidateTransactionQueriesForScope(queryClient, MAINNET)

        expect(queryClient.getQueryState(algorandKey)?.isInvalidated).toBe(true)
        expect(queryClient.getQueryState(testnetKey)?.isInvalidated).toBe(false)
        expect(queryClient.getQueryState(ethereumKey)?.isInvalidated).toBe(
            false,
        )
    })

    test("leaves another module's key on the same scope untouched", () => {
        const queryClient = new QueryClient()
        const foreignKey = ['accounts', 'balance', { scope: MAINNET }]
        queryClient.setQueryData(foreignKey, { value: 1 })

        invalidateTransactionQueriesForScope(queryClient, MAINNET)

        expect(queryClient.getQueryState(foreignKey)?.isInvalidated).toBe(false)
    })
})

describe('invalidateTransactionQueriesForAddresses', () => {
    test('stops at the given scope, since EVM chains share addresses', () => {
        const queryClient = new QueryClient()
        const ethereumKey = transactionQueryKeys.records('0xabc', ETHEREUM, {})
        const baseKey = transactionQueryKeys.records('0xabc', BASE, {})
        queryClient.setQueryData(ethereumKey, { value: 1 })
        queryClient.setQueryData(baseKey, { value: 2 })

        invalidateTransactionQueriesForAddresses(
            queryClient,
            ['0xabc'],
            ETHEREUM,
        )

        expect(queryClient.getQueryState(ethereumKey)?.isInvalidated).toBe(true)
        expect(queryClient.getQueryState(baseKey)?.isInvalidated).toBe(false)
    })

    test('invalidates only the targeted address histories', () => {
        const queryClient = new QueryClient()
        const targetKey = transactionQueryKeys.history('ADDR1', MAINNET)
        const otherKey = transactionQueryKeys.history('ADDR2', MAINNET)
        queryClient.setQueryData(targetKey, { value: 1 })
        queryClient.setQueryData(otherKey, { value: 2 })

        invalidateTransactionQueriesForAddresses(queryClient, ['ADDR1'])

        expect(queryClient.getQueryState(targetKey)?.isInvalidated).toBe(true)
        expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false)
    })

    test('invalidates filtered and paginated history keys for the address', () => {
        const queryClient = new QueryClient()
        const filteredKey = transactionQueryKeys.historyWithFilters(
            'ADDR1',
            MAINNET,
            { assetId: '456' },
        )
        const pageKey = transactionQueryKeys.paginatedHistory(
            'ADDR1',
            MAINNET,
            'https://api.example.com/next',
        )
        queryClient.setQueryData(filteredKey, { value: 1 })
        queryClient.setQueryData(pageKey, { value: 2 })

        invalidateTransactionQueriesForAddresses(queryClient, ['ADDR1'])

        expect(queryClient.getQueryState(filteredKey)?.isInvalidated).toBe(true)
        expect(queryClient.getQueryState(pageKey)?.isInvalidated).toBe(true)
    })

    test('leaves other modules with the same address untouched', () => {
        const queryClient = new QueryClient()
        const foreignKey = [
            'accounts',
            'balance',
            { address: 'ADDR1', scope: MAINNET },
        ]
        queryClient.setQueryData(foreignKey, { value: 1 })

        invalidateTransactionQueriesForAddresses(queryClient, ['ADDR1'])

        expect(queryClient.getQueryState(foreignKey)?.isInvalidated).toBe(false)
    })

    test('is a no-op for an empty address list', () => {
        const queryClient = new QueryClient()
        const key = transactionQueryKeys.history('ADDR1', MAINNET)
        queryClient.setQueryData(key, { value: 1 })

        invalidateTransactionQueriesForAddresses(queryClient, [])

        expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false)
    })
})

describe('NETWORK_PARTITIONED_QUERY_MODULES (chain-shared)', () => {
    test('includes this package MODULE_PREFIX, so clearCustomNetworkCache sweeps its custom-network entries', () => {
        // chain-shared/clearCustomNetworkCache.ts duplicates this package's
        // MODULE_PREFIX rather than importing it (importing back would cycle
        // — transactions depends on chain-shared). This test is the drift
        // guard: if MODULE_PREFIX is ever renamed here, this fails in this
        // package, where the rename is happening, instead of silently going
        // stale on the chain-shared side.
        expect(NETWORK_PARTITIONED_QUERY_MODULES.has(MODULE_PREFIX)).toBe(true)
    })
})

describe('asset inbox query keys', () => {
    test('requests key carries the address and scope under the asa-inbox prefix', () => {
        expect(getAssetInboxRequestsQueryKey('ADDR1', MAINNET)).toEqual([
            'asa-inbox',
            'requests',
            { address: 'ADDR1', scope: MAINNET },
        ])
    })

    test('send summary key carries the receiver, asset and scope', () => {
        expect(getAssetInboxSendSummaryQueryKey('RCV', '123', TESTNET)).toEqual(
            [
                'asa-inbox',
                'send-summary',
                { receiver: 'RCV', assetId: '123', scope: TESTNET },
            ],
        )
    })

    test('keys differ per scope', () => {
        expect(getAssetInboxRequestsQueryKey('ADDR1', MAINNET)).not.toEqual(
            getAssetInboxRequestsQueryKey('ADDR1', TESTNET),
        )
    })

    test('isAssetInboxQuery matches only the asa-inbox prefix', () => {
        const query = (key: unknown[]) => ({ queryKey: key }) as never

        expect(isAssetInboxQuery(query(['asa-inbox', 'requests']))).toBe(true)
        expect(isAssetInboxQuery(query(['transactions', 'history']))).toBe(
            false,
        )
    })
})
