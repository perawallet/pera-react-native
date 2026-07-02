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

import { describe, expect, it } from 'vitest'
import { Address, Transaction, TransactionType } from 'algosdk'
import { flattenSimulatedInnerTransactions } from '../simulateImpact'

const SENDER = Address.zeroAddress()
const RECEIVER = new Address(new Uint8Array(32).fill(7))

const payment = (amount: bigint): Transaction =>
    new Transaction({
        type: TransactionType.pay,
        sender: SENDER,
        suggestedParams: {
            fee: 1000n,
            minFee: 1000n,
            firstValid: 1000n,
            lastValid: 2000n,
            genesisHash: new Uint8Array(32),
        },
        paymentParams: {
            receiver: RECEIVER,
            amount,
        },
    })

// Shape mirrors algosdk's SimulateResponse: txnGroups[].txnResults[].txnResult
// is a PendingTransactionResponse whose .innerTxns recurse the same way.
// flattenSimulatedInnerTransactions reads structurally; the cast bridges the
// loosely-typed fixture nodes to the function's narrow structural param.
const responseWith = (innerTxns: unknown[]) =>
    ({
        txnGroups: [{ txnResults: [{ txnResult: { innerTxns } }] }],
    }) as Parameters<typeof flattenSimulatedInnerTransactions>[0]

describe('flattenSimulatedInnerTransactions', () => {
    it('returns an empty list when there are no inner transactions', () => {
        expect(flattenSimulatedInnerTransactions(undefined)).toEqual([])
        expect(flattenSimulatedInnerTransactions(responseWith([]))).toEqual([])
    })

    it('maps a single inner payment to a displayable transaction', () => {
        const result = flattenSimulatedInnerTransactions(
            responseWith([{ txn: { txn: payment(7n) } }]),
        )

        expect(result).toHaveLength(1)
        expect(result[0].paymentTransaction?.amount).toBe(7n)
    })

    it('walks nested inner transactions depth-first', () => {
        const result = flattenSimulatedInnerTransactions(
            responseWith([
                {
                    txn: { txn: payment(1n) },
                    innerTxns: [{ txn: { txn: payment(2n) } }],
                },
                { txn: { txn: payment(3n) } },
            ]),
        )

        expect(result.map(tx => tx.paymentTransaction?.amount)).toEqual([
            1n,
            2n,
            3n,
        ])
    })
})
