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
import { MODULE_PREFIX, transactionQueryKeys } from '../querykeys'

describe('transactionQueryKeys', () => {
    describe('all', () => {
        test('returns the module prefix', () => {
            expect(transactionQueryKeys.all).toEqual(['transactions'])
        })
    })

    describe('history', () => {
        test('includes account address and network', () => {
            const key = transactionQueryKeys.history('ADDR123', 'mainnet')

            expect(key).toEqual([
                'transactions',
                'history',
                { accountAddress: 'ADDR123', network: 'mainnet' },
            ])
        })

        test('produces different keys for different networks', () => {
            const mainnetKey = transactionQueryKeys.history(
                'ADDR123',
                'mainnet',
            )
            const testnetKey = transactionQueryKeys.history(
                'ADDR123',
                'testnet',
            )

            expect(mainnetKey).not.toEqual(testnetKey)
        })

        test('produces different keys for different addresses', () => {
            const key1 = transactionQueryKeys.history('ADDR1', 'mainnet')
            const key2 = transactionQueryKeys.history('ADDR2', 'mainnet')

            expect(key1).not.toEqual(key2)
        })
    })

    describe('historyWithFilters', () => {
        test('includes account address, network, and filters', () => {
            const key = transactionQueryKeys.historyWithFilters(
                'ADDR123',
                'mainnet',
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
                    network: 'mainnet',
                    assetId: '456',
                    limit: 25,
                },
            ])
        })

        test('produces different keys for different networks', () => {
            const filters = { assetId: '456' }
            const mainnetKey = transactionQueryKeys.historyWithFilters(
                'ADDR123',
                'mainnet',
                filters,
            )
            const testnetKey = transactionQueryKeys.historyWithFilters(
                'ADDR123',
                'testnet',
                filters,
            )

            expect(mainnetKey).not.toEqual(testnetKey)
        })

        test('produces different keys for different filters', () => {
            const key1 = transactionQueryKeys.historyWithFilters(
                'ADDR123',
                'mainnet',
                { assetId: '100' },
            )
            const key2 = transactionQueryKeys.historyWithFilters(
                'ADDR123',
                'mainnet',
                { assetId: '200' },
            )

            expect(key1).not.toEqual(key2)
        })
    })

    describe('paginatedHistory', () => {
        test('includes account address, network, and url', () => {
            const key = transactionQueryKeys.paginatedHistory(
                'ADDR123',
                'mainnet',
                'https://api.example.com/next',
            )

            expect(key).toEqual([
                'transactions',
                'history',
                'page',
                {
                    accountAddress: 'ADDR123',
                    network: 'mainnet',
                    url: 'https://api.example.com/next',
                },
            ])
        })

        test('produces different keys for different networks', () => {
            const url = 'https://api.example.com/next'
            const mainnetKey = transactionQueryKeys.paginatedHistory(
                'ADDR123',
                'mainnet',
                url,
            )
            const testnetKey = transactionQueryKeys.paginatedHistory(
                'ADDR123',
                'testnet',
                url,
            )

            expect(mainnetKey).not.toEqual(testnetKey)
        })
    })
})

describe('NETWORK_PARTITIONED_QUERY_MODULES (blockchain)', () => {
    test('includes this package MODULE_PREFIX, so clearCustomNetworkCache sweeps its custom-network entries', () => {
        // blockchain/clearCustomNetworkCache.ts duplicates this package's
        // MODULE_PREFIX rather than importing it (importing back would cycle
        // — transactions depends on blockchain). This test is the drift
        // guard: if MODULE_PREFIX is ever renamed here, this fails in this
        // package, where the rename is happening, instead of silently going
        // stale on the blockchain side.
        expect(NETWORK_PARTITIONED_QUERY_MODULES.has(MODULE_PREFIX)).toBe(true)
    })
})
