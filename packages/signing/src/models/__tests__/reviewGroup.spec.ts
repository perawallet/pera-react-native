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

import { describe, expect, it } from 'vitest'
import {
    asUnsignedAlgorandTransaction,
    makeTestAddress,
    makeTestPaymentTx,
} from '../../__tests__/transactions'
import type { FeeAdjustment, TransactionSignRequest } from '../index'
import { reviewGroupOf } from '../reviewGroup'

const [tx0, tx1] = [1n, 2n].map(amount =>
    makeTestPaymentTx(makeTestAddress(1), {
        receiver: makeTestAddress(2),
        amount,
    }),
)
const signerOverrides = new Map([[0, 'AUTH']])
const feeAdjustments: FeeAdjustment[] = [
    { index: 1, originalFee: 1n, adjustedFee: 2n, reason: 'quantum-minimum' },
]

describe('reviewGroupOf', () => {
    it("reads a chain-neutral request's Algorand group facts", () => {
        const [neutral0, neutral1] = [tx0, tx1].map(txn =>
            asUnsignedAlgorandTransaction(txn),
        )
        const request = {
            id: 'req',
            type: 'transactions',
            transport: 'callback',
            txs: [neutral1],
            chainData: {
                algorand: {
                    groupContext: [neutral0, neutral1],
                    signableIndices: [1],
                    signerOverrides,
                    feeAdjustments,
                },
            },
        } satisfies TransactionSignRequest

        expect(reviewGroupOf(request)).toEqual({
            transactions: [neutral0, neutral1],
            groupContext: [neutral0, neutral1],
            signableIndices: [1],
            signerOverrides,
            feeAdjustments,
        })
    })

    it('shows `txs` when a request carries no full group', () => {
        const txs = [asUnsignedAlgorandTransaction(tx0)]

        expect(
            reviewGroupOf({
                id: 'req',
                type: 'transactions',
                transport: 'algod',
                txs,
            }),
        ).toEqual({ transactions: txs })
    })
})
