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
    getArc59SendSummaryQueryKey,
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
        test('includes the transaction ID in the key', () => {
            const key = getTransactionDetailQueryKey('TXID123')

            expect(key).toEqual([
                'blockchain',
                'transaction-detail',
                { transactionId: 'TXID123' },
            ])
        })
    })

    describe('getArc59SendSummaryQueryKey', () => {
        test('includes receiver and asset in the key', () => {
            const key = getArc59SendSummaryQueryKey('RECEIVER', '12345')

            expect(key).toEqual([
                'blockchain',
                'arc59-send-summary',
                { receiverAddress: 'RECEIVER', assetId: '12345' },
            ])
        })

        test('produces different keys for different receivers', () => {
            const key1 = getArc59SendSummaryQueryKey('RECV1', '100')
            const key2 = getArc59SendSummaryQueryKey('RECV2', '100')

            expect(key1).not.toEqual(key2)
        })

        test('produces different keys for different asset IDs', () => {
            const key1 = getArc59SendSummaryQueryKey('RECV', '100')
            const key2 = getArc59SendSummaryQueryKey('RECV', '200')

            expect(key1).not.toEqual(key2)
        })
    })
})
