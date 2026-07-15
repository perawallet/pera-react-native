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
import { Address, Transaction } from 'algosdk'
import { groupTransactions } from '@perawallet/wallet-core-blockchain'
import {
    makeTestAddress,
    makeTestPaymentTx,
} from '../../test-utils/transactions'

import {
    validateCosignSubsetIntegrity,
    validateTransactionGroupIntegrity,
} from '../validateTransactionGroupIntegrity'
import { InvalidSignableDataError } from '../../pipeline/errors'

const senderA = makeTestAddress(1)
const senderB = makeTestAddress(2)

const makePayment = (sender: Address, amount: bigint): Transaction =>
    makeTestPaymentTx(sender, { receiver: senderB, amount })

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

    test('rejects when txns with the same group ID are not contiguous (spec violation)', () => {
        // ARC-0001 §group rules: txns sharing a group ID must be consecutive.
        // [A_grpX, B_grpY, A_grpX] would pass per-partition hash recompute
        // (the dApp computed grpX over [A, A] originally) but breaks the
        // ordering rule — wallet MUST reject.
        const groupX = groupTransactions([
            makePayment(senderA, 1n),
            makePayment(senderA, 2n),
        ])
        const groupY = groupTransactions([
            makePayment(senderA, 3n),
            makePayment(senderA, 4n),
        ])
        const interleaved = [groupX[0], groupY[0], groupY[1], groupX[1]]
        expect(() => validateTransactionGroupIntegrity(interleaved)).toThrow(
            InvalidSignableDataError,
        )
        expect(() => validateTransactionGroupIntegrity(interleaved)).toThrow(
            'group transactions with the same group ID must be contiguous',
        )
    })

    test('rejects when an ungrouped txn splits members of the same group', () => {
        // [A_grpX, ungrouped, B_grpX] — group X members aren't contiguous.
        const groupX = groupTransactions([
            makePayment(senderA, 1n),
            makePayment(senderA, 2n),
        ])
        const split = [groupX[0], makePayment(senderA, 9n), groupX[1]]
        expect(() => validateTransactionGroupIntegrity(split)).toThrow(
            'group transactions with the same group ID must be contiguous',
        )
    })

    test('validateCosignSubsetIntegrity skips the group-hash recompute (co-sign subset)', () => {
        // A co-signer only holds the multisig-signable subset of a larger
        // atomic group (e.g. a swap's pre-signed pool/fee slots never reach
        // them). The surviving txns still carry the full group's hash, so the
        // strict recompute would reject — but the cosign validator skips it.
        const fullGroup = groupTransactions([
            makePayment(senderA, 1n),
            makePayment(senderA, 2n),
            makePayment(senderA, 3n),
        ])
        const subset = [fullGroup[0], fullGroup[1]]
        expect(() => validateCosignSubsetIntegrity(subset)).not.toThrow()
    })

    test('validateCosignSubsetIntegrity still enforces contiguity', () => {
        // Skipping the hash recompute must NOT disable the ARC-0001 ordering
        // guard — a malicious backend still cannot scatter members of distinct
        // groups into one cosign payload.
        const groupX = groupTransactions([
            makePayment(senderA, 1n),
            makePayment(senderA, 2n),
        ])
        const groupY = groupTransactions([
            makePayment(senderA, 3n),
            makePayment(senderA, 4n),
        ])
        const interleaved = [groupX[0], groupY[0], groupY[1], groupX[1]]
        expect(() => validateCosignSubsetIntegrity(interleaved)).toThrow(
            'group transactions with the same group ID must be contiguous',
        )
    })

    test('validateCosignSubsetIntegrity passes a multi-group co-sign subset (swap shape)', () => {
        // A swap flattens the signable txns of several atomic groups (opt-in,
        // swap, fee) into one cosign list. Each contributes only its signable
        // members, contiguously — distinct group IDs, each incomplete.
        const optIn = groupTransactions([
            makePayment(senderA, 1n),
            makePayment(senderA, 2n),
        ])
        const swap = groupTransactions([
            makePayment(senderA, 3n),
            makePayment(senderA, 4n),
        ])
        // one signable member from each group, preserving order
        const subset = [optIn[0], swap[0]]
        expect(() => validateCosignSubsetIntegrity(subset)).not.toThrow()
    })

    test('passes when distinct groups are concatenated contiguously (Format 2)', () => {
        // Sanity: the spec's allowed shape — multiple complete groups
        // concatenated in order — must still pass.
        const groupX = groupTransactions([
            makePayment(senderA, 1n),
            makePayment(senderA, 2n),
        ])
        const groupY = groupTransactions([
            makePayment(senderA, 3n),
            makePayment(senderA, 4n),
        ])
        const concatenated = [...groupX, ...groupY]
        expect(() =>
            validateTransactionGroupIntegrity(concatenated),
        ).not.toThrow()
    })
})
