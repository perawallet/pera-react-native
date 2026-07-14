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
import { transactionQueryKeys } from '../querykeys'

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
