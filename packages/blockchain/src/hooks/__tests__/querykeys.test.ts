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
import {
    getAccountInformationQueryKey,
    getSuggestedParametersQueryKey,
    getTransactionDetailQueryKey,
} from '../querykeys'

describe('querykeys', () => {
    describe('getAccountInformationQueryKey', () => {
        test('includes the address in the key', () => {
            const key = getAccountInformationQueryKey('ADDR123')

            expect(key).toEqual([
                'blockchain',
                'account-information',
                { address: 'ADDR123' },
            ])
        })

        test('produces different keys for different addresses', () => {
            const key1 = getAccountInformationQueryKey('ADDR1')
            const key2 = getAccountInformationQueryKey('ADDR2')

            expect(key1).not.toEqual(key2)
        })
    })

    describe('getSuggestedParametersQueryKey', () => {
        test('returns a stable key', () => {
            const key = getSuggestedParametersQueryKey()

            expect(key).toEqual(['blockchain', 'suggested-parameters'])
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
})
