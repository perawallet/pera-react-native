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

import { describe, expect, test } from 'vitest'
import { Address, computeGroupID, Transaction } from 'algosdk'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    encodeTransactionRaw,
    groupTransactions,
    rawTransactionsMatch,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { bytesEqual, encodeToBase64 } from '@perawallet/wallet-core-shared'

import {
    makeTestAddress,
    makeTestPaymentTx,
} from '../../../test-utils/transactions'
import { validateTransactionGroupIntegrity } from '../../../utils/validateTransactionGroupIntegrity'
import { InvalidSignableDataError } from '../../errors'
import { applyQuantumFeeOverride } from '../applyQuantumFeeOverride'

const quantumAddress = makeTestAddress(1)
const algoAddress = makeTestAddress(2)
const externalAddress = makeTestAddress(3)
const receiverAddress = makeTestAddress(9)

const quantum = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: 'q1',
        address: quantumAddress.toString(),
        type: AccountTypes.quantum,
        keyPairId: 'kp-quantum',
        ...overrides,
    }) as WalletAccount

const algo25 = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: 'a1',
        address: algoAddress.toString(),
        type: AccountTypes.algo25,
        keyPairId: 'kp-algo25',
        ...overrides,
    }) as WalletAccount

/** Payment with a dApp-chosen flat fee. Set BEFORE any grouping. */
const makePayment = (sender: Address, fee: bigint): PeraTransaction => {
    const tx = makeTestPaymentTx(sender, {
        receiver: receiverAddress,
        amount: 1n,
    })
    tx.fee = fee
    return tx
}

const baseParams = {
    suggestedMinFee: 1000n,
    configMinTxnFee: 1000n,
    pqMultiplier: 3n,
}

const encode = (tx: PeraTransaction): string =>
    encodeToBase64(encodeTransactionRaw(tx))

describe('applyQuantumFeeOverride', () => {
    test('raises a quantum-signed fee below the PQ minimum', () => {
        const tx = makePayment(quantumAddress, 1000n)

        const result = applyQuantumFeeOverride({
            ...baseParams,
            transactions: [tx],
            signableIndices: [0],
            accounts: [quantum()],
        })

        expect(result.transactions[0].fee).toBe(3000n)
        expect(result.adjustments).toEqual([
            { index: 0, originalFee: 1000n, adjustedFee: 3000n },
        ])
        // the original transaction is never mutated
        expect(tx.fee).toBe(1000n)
    })

    test('leaves a fee exactly at the PQ minimum untouched (same array reference)', () => {
        const transactions = [makePayment(quantumAddress, 3000n)]

        const result = applyQuantumFeeOverride({
            ...baseParams,
            transactions,
            signableIndices: [0],
            accounts: [quantum()],
        })

        expect(result.transactions).toBe(transactions)
        expect(result.adjustments).toEqual([])
    })

    test('never lowers a fee above the PQ minimum', () => {
        const transactions = [makePayment(quantumAddress, 5000n)]

        const result = applyQuantumFeeOverride({
            ...baseParams,
            transactions,
            signableIndices: [0],
            accounts: [quantum()],
        })

        expect(result.transactions).toBe(transactions)
        expect(result.transactions[0].fee).toBe(5000n)
        expect(result.adjustments).toEqual([])
    })

    test('non-quantum signer is never touched, even below the plain minimum', () => {
        const transactions = [makePayment(algoAddress, 500n)]
        const before = transactions.map(encode)

        const result = applyQuantumFeeOverride({
            ...baseParams,
            transactions,
            signableIndices: [0],
            accounts: [algo25()],
        })

        expect(result.transactions).toBe(transactions)
        expect(result.adjustments).toEqual([])
        expect(
            rawTransactionsMatch(before, result.transactions.map(encode)),
        ).toBe(true)
    })

    test('recomputes the group ID over the ENTIRE partition, including txns Pera does not sign', () => {
        const grouped = groupTransactions([
            makePayment(quantumAddress, 1000n),
            makePayment(externalAddress, 1000n),
            makePayment(externalAddress, 1000n),
        ])
        const originalGroup = grouped[0].group as Uint8Array

        const result = applyQuantumFeeOverride({
            ...baseParams,
            transactions: grouped,
            signableIndices: [0],
            accounts: [quantum()],
        })

        const newGroup = result.transactions[0].group as Uint8Array
        expect(newGroup).toBeDefined()
        expect(bytesEqual(newGroup, originalGroup)).toBe(false)
        for (const tx of result.transactions) {
            expect(bytesEqual(tx.group as Uint8Array, newGroup)).toBe(true)
        }

        // the new grp is exactly computeGroupID over group-cleared clones
        const ungrouped = result.transactions.map(tx => {
            const clone = Transaction.fromEncodingData(tx.toEncodingData())
            clone.group = undefined
            return clone
        })
        expect(bytesEqual(computeGroupID(ungrouped), newGroup)).toBe(true)
    })

    test('modified group passes validateTransactionGroupIntegrity', () => {
        const grouped = groupTransactions([
            makePayment(quantumAddress, 1000n),
            makePayment(externalAddress, 1000n),
        ])

        const result = applyQuantumFeeOverride({
            ...baseParams,
            transactions: grouped,
            signableIndices: [0],
            accounts: [quantum()],
        })

        expect(() =>
            validateTransactionGroupIntegrity(result.transactions),
        ).not.toThrow()
    })

    test('throws InvalidSignableDataError when the incoming group is tampered and a modification is needed', () => {
        const grouped = groupTransactions([
            makePayment(quantumAddress, 1000n),
            makePayment(externalAddress, 1000n),
        ])
        // tamper one member's claimed group ID
        ;(grouped[1].group as Uint8Array)[0] ^= 0xff

        expect(() =>
            applyQuantumFeeOverride({
                ...baseParams,
                transactions: grouped,
                signableIndices: [0],
                accounts: [quantum()],
            }),
        ).toThrow(InvalidSignableDataError)
    })

    test('tampered group with no quantum signer is returned untouched (no modification path)', () => {
        const grouped = groupTransactions([
            makePayment(algoAddress, 1000n),
            makePayment(externalAddress, 1000n),
        ])
        ;(grouped[1].group as Uint8Array)[0] ^= 0xff

        const result = applyQuantumFeeOverride({
            ...baseParams,
            transactions: grouped,
            signableIndices: [0],
            accounts: [algo25()],
        })

        expect(result.transactions).toBe(grouped)
        expect(result.adjustments).toEqual([])
    })

    test('re-groups only the affected partition; other groups keep object references and bytes', () => {
        const groupA = groupTransactions([
            makePayment(quantumAddress, 1000n),
            makePayment(externalAddress, 1000n),
        ])
        const groupB = groupTransactions([
            makePayment(algoAddress, 1000n),
            makePayment(algoAddress, 1000n),
        ])
        const transactions = [...groupA, ...groupB]
        const groupBBytesBefore = groupB.map(encode)

        const result = applyQuantumFeeOverride({
            ...baseParams,
            transactions,
            signableIndices: [0, 2, 3],
            accounts: [quantum(), algo25()],
        })

        // group A re-grouped with the raised fee
        expect(result.transactions[0].fee).toBe(3000n)
        expect(result.adjustments).toEqual([
            { index: 0, originalFee: 1000n, adjustedFee: 3000n },
        ])
        expect(
            bytesEqual(
                result.transactions[0].group as Uint8Array,
                groupA[0].group as Uint8Array,
            ),
        ).toBe(false)

        // group B members: identical object references and identical bytes
        expect(result.transactions[2]).toBe(transactions[2])
        expect(result.transactions[3]).toBe(transactions[3])
        expect(
            rawTransactionsMatch(groupBBytesBefore, [
                encode(result.transactions[2]),
                encode(result.transactions[3]),
            ]),
        ).toBe(true)
    })

    test('ungrouped quantum txn gets only the fee change, group stays undefined', () => {
        const tx = makePayment(quantumAddress, 1000n)

        const result = applyQuantumFeeOverride({
            ...baseParams,
            transactions: [tx],
            signableIndices: [0],
            accounts: [quantum()],
        })

        expect(result.transactions[0].fee).toBe(3000n)
        expect(result.transactions[0].group).toBeUndefined()
    })

    test('follows the rekey: ed25519 sender rekeyed to quantum auth is raised', () => {
        const tx = makePayment(algoAddress, 1000n)

        const result = applyQuantumFeeOverride({
            ...baseParams,
            transactions: [tx],
            signableIndices: [0],
            accounts: [
                algo25({ rekeyAddress: quantumAddress.toString() }),
                quantum(),
            ],
        })

        expect(result.transactions[0].fee).toBe(3000n)
        expect(result.adjustments).toEqual([
            { index: 0, originalFee: 1000n, adjustedFee: 3000n },
        ])
    })

    test('follows the rekey: quantum sender rekeyed to ed25519 auth is untouched', () => {
        const transactions = [makePayment(quantumAddress, 1000n)]

        const result = applyQuantumFeeOverride({
            ...baseParams,
            transactions,
            signableIndices: [0],
            accounts: [
                quantum({ rekeyAddress: algoAddress.toString() }),
                algo25(),
            ],
        })

        expect(result.transactions).toBe(transactions)
        expect(result.adjustments).toEqual([])
    })

    test('resolves the authorizer from signerOverrides by SUBSET position, not group index', () => {
        // subset position 0 → group index 1; the override points signing at
        // the quantum account even though the sender is external
        const transactions = [
            makePayment(algoAddress, 5000n),
            makePayment(externalAddress, 1000n),
        ]

        const result = applyQuantumFeeOverride({
            ...baseParams,
            transactions,
            signableIndices: [1],
            signerOverrides: new Map([[0, quantumAddress.toString()]]),
            accounts: [quantum(), algo25()],
        })

        expect(result.transactions[1].fee).toBe(3000n)
        expect(result.adjustments).toEqual([
            { index: 1, originalFee: 1000n, adjustedFee: 3000n },
        ])
        // untouched txn keeps its original reference
        expect(result.transactions[0]).toBe(transactions[0])
    })

    test('congestion guard: multiplies the max of suggested and config base, once', () => {
        const result = applyQuantumFeeOverride({
            transactions: [makePayment(quantumAddress, 1000n)],
            signableIndices: [0],
            accounts: [quantum()],
            suggestedMinFee: 2000n,
            configMinTxnFee: 1000n,
            pqMultiplier: 3n,
        })

        expect(result.transactions[0].fee).toBe(6000n)
        expect(result.adjustments).toEqual([
            { index: 0, originalFee: 1000n, adjustedFee: 6000n },
        ])
    })

    test('adjustment indices are group-space indices with exact fees', () => {
        const grouped = groupTransactions([
            makePayment(externalAddress, 1000n),
            makePayment(externalAddress, 1000n),
            makePayment(quantumAddress, 1500n),
        ])

        const result = applyQuantumFeeOverride({
            ...baseParams,
            transactions: grouped,
            signableIndices: [2],
            accounts: [quantum()],
        })

        expect(result.adjustments).toEqual([
            { index: 2, originalFee: 1500n, adjustedFee: 3000n },
        ])
        expect(result.transactions[2].fee).toBe(3000n)
    })
})
