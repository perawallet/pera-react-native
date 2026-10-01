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
import { Decimal } from 'decimal.js'
import { groupTransactions } from '@perawallet/wallet-core-blockchain'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { InvalidSignableDataError } from '@perawallet/wallet-core-signing'
import { algorandPlannerAdapter } from '../adapter'
import { makeTestAddress, makeTestPaymentTx } from './transactions'

const senderA = makeTestAddress(1)
const senderB = makeTestAddress(2)

describe('algorandPlannerAdapter', () => {
    test('reviewGroupFees reports the total fee and no warning for a cheap group', () => {
        const txs = [
            { fee: 1000n, txType: 'pay', sender: 'ADDR1' },
            { fee: 2000n, txType: 'pay', sender: 'ADDR1' },
        ] as unknown as PeraDisplayableTransaction[]

        const review = algorandPlannerAdapter.reviewGroupFees(
            txs,
            new Set(['ADDR1']),
        )

        expect(review.totalFee.eq(new Decimal(0.003))).toBe(true)
        expect(review.highFeeWarning).toBeNull()
    })

    test('validateGroup skips the group-hash recompute only for a cosigner', () => {
        const pair = groupTransactions([
            makeTestPaymentTx(senderA, { receiver: senderB, amount: 1n }),
            makeTestPaymentTx(senderA, { receiver: senderB, amount: 2n }),
        ])
        const subset = [pair[0]]

        expect(() =>
            algorandPlannerAdapter.validateGroup(subset, { isCosigner: true }),
        ).not.toThrow()
        expect(() =>
            algorandPlannerAdapter.validateGroup(subset, { isCosigner: false }),
        ).toThrow(InvalidSignableDataError)
    })
})
