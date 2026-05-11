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

    test('passes when grouped and ungrouped transactions are mixed (per ARC-0001)', () => {
        // ARC-0001 permits a request to contain a complete atomic group
        // alongside independent ungrouped transactions. Each grouped
        // partition is validated; ungrouped txs are independent.
        const grouped = groupTransactions([
            makePayment(senderA, 1n),
            makePayment(senderA, 2n),
        ])
        const mixed = [grouped[0], grouped[1], makePayment(senderA, 3n)]
        expect(() => validateTransactionGroupIntegrity(mixed)).not.toThrow()
    })

    test('passes when the request contains multiple complete atomic groups', () => {
        // ARC-0001 permits multiple atomic groups in a single request.
        const groupA = groupTransactions([
            makePayment(senderA, 1n),
            makePayment(senderA, 2n),
        ])
        const groupB = groupTransactions([
            makePayment(senderA, 3n),
            makePayment(senderA, 4n),
        ])
        const both = [...groupA, ...groupB]
        expect(() => validateTransactionGroupIntegrity(both)).not.toThrow()
    })

    test('rejects a partial fragment of a multi-tx group', () => {
        // 1-tx-of-2-tx fragment: the survivor still carries the original
        // group hash, but recompute over the survivor alone won't match.
        const grouped = groupTransactions([
            makePayment(senderA, 1n),
            makePayment(senderA, 2n),
        ])
        const fragment = [grouped[0]]
        expect(() => validateTransactionGroupIntegrity(fragment)).toThrow(
            InvalidSignableDataError,
        )
        expect(() => validateTransactionGroupIntegrity(fragment)).toThrow(
            'group ID does not match the transactions provided',
        )
    })

    test('rejects when one of multiple groups is incomplete', () => {
        // First group is complete and would pass; second group is a partial
        // (1-of-2) — the whole request must fail.
        const groupA = groupTransactions([
            makePayment(senderA, 1n),
            makePayment(senderA, 2n),
        ])
        const groupB = groupTransactions([
            makePayment(senderA, 3n),
            makePayment(senderA, 4n),
        ])
        const partialB = [...groupA, groupB[0]]
        expect(() => validateTransactionGroupIntegrity(partialB)).toThrow(
            InvalidSignableDataError,
        )
        expect(() => validateTransactionGroupIntegrity(partialB)).toThrow(
            'group ID does not match the transactions provided',
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
