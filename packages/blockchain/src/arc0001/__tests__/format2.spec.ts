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

import { describe, it, expect } from 'vitest'
import { Address } from '@algorandfoundation/algokit-utils/common'
import {
    Transaction,
    TransactionType,
    encodeTransaction,
    groupTransactions,
} from '@algorandfoundation/algokit-utils/transact'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'

import { resolveArc0001SignTxnRequest } from '../resolve'

const sender = new Address(new Uint8Array(32).fill(1))
const receiver = new Address(new Uint8Array(32).fill(2))
const baseSP = {
    fee: 1000n,
    firstValid: 1n,
    lastValid: 1000n,
    genesisHash: new Uint8Array(32).fill(0xab),
    genesisId: 'testnet-v1.0',
}

const mkPay = (amount: bigint): Transaction =>
    new Transaction({
        type: TransactionType.Payment,
        sender,
        payment: { receiver, amount },
        ...baseSP,
    })

describe('ARC-0001 Format 2 — multiple groups concatenated in one request', () => {
    it('preserves each txns group field through decode so downstream UI can partition', () => {
        // Build two distinct atomic groups (groupA: 2 txns, groupB: 2 txns).
        const groupA = groupTransactions([mkPay(1n), mkPay(2n)])
        const groupB = groupTransactions([mkPay(3n), mkPay(4n)])

        const wireTxns = [...groupA, ...groupB].map(tx => ({
            txn: encodeToBase64(encodeTransaction(tx)),
        }))

        const result = resolveArc0001SignTxnRequest(
            { transactions: wireTxns },
            { signableAddresses: new Set([sender.toString()]) },
        )

        expect(result.allDecoded).toHaveLength(4)
        expect(result.toSign).toHaveLength(4)

        // Each tx's .group must survive decode — that's the field the
        // downstream signing UI partitions on.
        const grpHexes = result.allDecoded.map(t =>
            t.group ? Buffer.from(t.group).toString('hex') : null,
        )
        expect(grpHexes.every(g => g !== null)).toBe(true)
        // First two share groupA, last two share groupB.
        expect(grpHexes[0]).toBe(grpHexes[1])
        expect(grpHexes[2]).toBe(grpHexes[3])
        expect(grpHexes[0]).not.toBe(grpHexes[2])
    })

    it('keeps non-atomic txns ungrouped (group field stays undefined)', () => {
        // Three independent payment txns — no assignGroupID call.
        const wireTxns = [1n, 2n, 3n].map(a => ({
            txn: encodeToBase64(encodeTransaction(mkPay(a))),
        }))

        const result = resolveArc0001SignTxnRequest(
            { transactions: wireTxns },
            { signableAddresses: new Set([sender.toString()]) },
        )

        expect(result.allDecoded).toHaveLength(3)
        expect(result.allDecoded.every(t => t.group === undefined)).toBe(true)
    })

    it('preserves group field on the signable subset (txs that reach the signing UI)', () => {
        // Mixed: atomic group of 2 + 1 ungrouped.
        const grouped = groupTransactions([mkPay(1n), mkPay(2n)])
        const standalone = mkPay(3n)
        const wireTxns = [...grouped, standalone].map(tx => ({
            txn: encodeToBase64(encodeTransaction(tx)),
        }))

        const result = resolveArc0001SignTxnRequest(
            { transactions: wireTxns },
            { signableAddresses: new Set([sender.toString()]) },
        )

        // The signing UI iterates toSign.map(t => t.decoded) — the
        // group field must be present on the decoded shape.
        expect(result.toSign).toHaveLength(3)
        expect(result.toSign[0].decoded.group).toBeDefined()
        expect(result.toSign[1].decoded.group).toBeDefined()
        expect(result.toSign[2].decoded.group).toBeUndefined()
    })
})
