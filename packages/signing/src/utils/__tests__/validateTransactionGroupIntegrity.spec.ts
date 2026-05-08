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
import { Address } from '@algorandfoundation/algokit-utils/common'
import {
    Transaction,
    TransactionType,
    groupTransactions,
} from '@algorandfoundation/algokit-utils/transact'

import { validateTransactionGroupIntegrity } from '../validateTransactionGroupIntegrity'
import { InvalidSignableDataError } from '../../pipeline/errors'

const senderA = new Address(new Uint8Array(32).fill(1))
const senderB = new Address(new Uint8Array(32).fill(2))

const baseParams = {
    fee: 1000n,
    firstValid: 1000n,
    lastValid: 2000n,
    genesisId: 'mainnet-v1.0',
    genesisHash: new Uint8Array(32).fill(0xab),
}

const makePayment = (sender: Address, amount: bigint): Transaction =>
    new Transaction({
        type: TransactionType.Payment,
        sender,
        ...baseParams,
        payment: { receiver: senderB, amount },
    })

describe('validateTransactionGroupIntegrity', () => {
    test('passes when no transaction declares a group', () => {
        const txns = [makePayment(senderA, 1n), makePayment(senderA, 2n)]
        expect(() => validateTransactionGroupIntegrity(txns)).not.toThrow()
    })

    test('passes when a single ungrouped transaction is provided', () => {
        const txns = [makePayment(senderA, 1n)]
        expect(() => validateTransactionGroupIntegrity(txns)).not.toThrow()
    })

    test('passes for a properly grouped pair', () => {
        const grouped = groupTransactions([
            makePayment(senderA, 1n),
            makePayment(senderA, 2n),
        ])
        expect(() => validateTransactionGroupIntegrity(grouped)).not.toThrow()
    })

    test('passes for a cross-account group (express-send shape)', () => {
        // Express send: 3 txs, the middle one is signed by a different
        // account (the receiver). The pipeline used to filter the middle
        // tx out before validation, breaking the recompute. We now validate
        // on the FULL request, so the cross-account group passes.
        const grouped = groupTransactions([
            makePayment(senderA, 1n),
            makePayment(senderB, 0n),
            makePayment(senderA, 2n),
        ])
        expect(() => validateTransactionGroupIntegrity(grouped)).not.toThrow()
    })

    test('rejects when only some transactions declare a group', () => {
        const grouped = groupTransactions([
            makePayment(senderA, 1n),
            makePayment(senderA, 2n),
        ])
        const mixed = [grouped[0], makePayment(senderA, 3n)]
        expect(() => validateTransactionGroupIntegrity(mixed)).toThrow(
            InvalidSignableDataError,
        )
        expect(() => validateTransactionGroupIntegrity(mixed)).toThrow(
            'some transactions are not part of the declared group',
        )
    })

    test('rejects when transactions reference different group IDs', () => {
        const groupA = groupTransactions([
            makePayment(senderA, 1n),
            makePayment(senderA, 2n),
        ])
        const groupB = groupTransactions([
            makePayment(senderA, 3n),
            makePayment(senderA, 4n),
        ])
        const mixed = [groupA[0], groupB[0]]
        expect(() => validateTransactionGroupIntegrity(mixed)).toThrow(
            InvalidSignableDataError,
        )
        expect(() => validateTransactionGroupIntegrity(mixed)).toThrow(
            'transactions reference different group IDs',
        )
    })

    test('rejects when claimed group ID does not match recomputed ID (stale group)', () => {
        // Simulates a dApp sending a 3-tx group with one tx removed before
        // forwarding to the wallet — the surviving txs still carry the
        // group ID computed over all 3, so recompute over the 2 survivors
        // will not match.
        const fullGroup = groupTransactions([
            makePayment(senderA, 1n),
            makePayment(senderA, 2n),
            makePayment(senderA, 3n),
        ])
        const stale = [fullGroup[0], fullGroup[1]]
        expect(() => validateTransactionGroupIntegrity(stale)).toThrow(
            InvalidSignableDataError,
        )
        expect(() => validateTransactionGroupIntegrity(stale)).toThrow(
            'group ID does not match the transactions provided',
        )
    })
})
