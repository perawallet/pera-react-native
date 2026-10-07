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
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import {
    getSuggestedParametersQueryKey,
    getTransactionDetailQueryKey,
    getGroupTransactionsQueryKey,
    isBlockchainQuery,
} from '../querykeys'

const MAINNET = scopeForLegacyNetwork('mainnet')
const TESTNET = scopeForLegacyNetwork('testnet')

describe('querykeys', () => {
    describe('getSuggestedParametersQueryKey', () => {
        test('carries the scope object in the key', () => {
            const key = getSuggestedParametersQueryKey(MAINNET)

            expect(key).toEqual([
                'blockchain',
                'suggested-parameters',
                { scope: { chainId: 'algorand', networkId: 'mainnet' } },
            ])
        })
    })

    describe('getTransactionDetailQueryKey', () => {
        test('includes the transaction ID and scope in the key', () => {
            const key = getTransactionDetailQueryKey('TXID123', MAINNET)

            expect(key).toEqual([
                'blockchain',
                'transaction-detail',
                { transactionId: 'TXID123', scope: MAINNET },
            ])
        })

        test('produces different keys for different scopes', () => {
            const key1 = getTransactionDetailQueryKey('TXID123', MAINNET)
            const key2 = getTransactionDetailQueryKey('TXID123', TESTNET)

            expect(key1).not.toEqual(key2)
        })
    })

    describe('isBlockchainQuery', () => {
        test('returns true for keys built by the blockchain key factories', () => {
            expect(
                isBlockchainQuery(getSuggestedParametersQueryKey(MAINNET)),
            ).toBe(true)
            expect(
                isBlockchainQuery(
                    getTransactionDetailQueryKey('TXID123', MAINNET),
                ),
            ).toBe(true)
            expect(
                isBlockchainQuery(
                    getGroupTransactionsQueryKey('GROUP123', MAINNET),
                ),
            ).toBe(true)
        })

        test('returns false for other module prefixes and an empty key', () => {
            expect(isBlockchainQuery(['accounts', 'balance'])).toBe(false)
            expect(isBlockchainQuery([])).toBe(false)
        })
    })
})
