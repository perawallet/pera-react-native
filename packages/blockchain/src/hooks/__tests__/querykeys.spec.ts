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
import {
    getSuggestedParametersQueryKey,
    getTransactionDetailQueryKey,
    getGroupTransactionsQueryKey,
    isBlockchainQuery,
} from '../querykeys'

describe('querykeys', () => {
    describe('getSuggestedParametersQueryKey', () => {
        test('includes the network in the key', () => {
            const key = getSuggestedParametersQueryKey('mainnet')

            expect(key).toEqual([
                'blockchain',
                'suggested-parameters',
                { network: 'mainnet' },
            ])
        })
    })

    describe('getTransactionDetailQueryKey', () => {
        test('includes the transaction ID and network in the key', () => {
            const key = getTransactionDetailQueryKey('TXID123', 'mainnet')

            expect(key).toEqual([
                'blockchain',
                'transaction-detail',
                { transactionId: 'TXID123', network: 'mainnet' },
            ])
        })

        test('produces different keys for different networks', () => {
            const key1 = getTransactionDetailQueryKey('TXID123', 'mainnet')
            const key2 = getTransactionDetailQueryKey('TXID123', 'testnet')

            expect(key1).not.toEqual(key2)
        })
    })

    describe('isBlockchainQuery', () => {
        test('returns true for keys built by the blockchain key factories', () => {
            expect(
                isBlockchainQuery(getSuggestedParametersQueryKey('mainnet')),
            ).toBe(true)
            expect(
                isBlockchainQuery(
                    getTransactionDetailQueryKey('TXID123', 'mainnet'),
                ),
            ).toBe(true)
            expect(
                isBlockchainQuery(
                    getGroupTransactionsQueryKey('GROUP123', 'mainnet'),
                ),
            ).toBe(true)
        })

        test('returns false for other module prefixes and an empty key', () => {
            expect(isBlockchainQuery(['accounts', 'balance'])).toBe(false)
            expect(isBlockchainQuery([])).toBe(false)
        })
    })
})
