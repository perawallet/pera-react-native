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

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
    computeGroupID,
    Transaction,
    type Transaction as AlgoTransaction,
} from 'algosdk'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import {
    makeTestAddress,
    makeTestPaymentTx,
} from '../../test-utils/transactions'
import {
    deriveRequestGroupTxIds,
    isRequestGroupAlreadySubmitted,
    recordSubmissionAttempt,
    resolveSubmissionAttempt,
} from '..'
import type { SignRequest } from '../../models'

// Reproduces the pipeline's submit-time derivation: group copies of the
// ungrouped originals, then read the txids.
const submitTimeTxIds = (txs: AlgoTransaction[]): string[] => {
    const ungrouped = txs.map(txn => {
        const clone = Transaction.fromEncodingData(txn.toEncodingData())
        clone.group = undefined
        return clone
    })
    const groupId = computeGroupID(ungrouped)
    return txs.map(txn => {
        const clone = Transaction.fromEncodingData(txn.toEncodingData())
        clone.group = groupId
        return clone.txID()
    })
}

const makeGroup = (): AlgoTransaction[] => {
    const sender = makeTestAddress(1)
    const receiver = makeTestAddress(2)
    return [
        makeTestPaymentTx(sender, { receiver }),
        makeTestPaymentTx(receiver, { receiver: sender }),
    ]
}

const makeTransactionSignRequest = (
    txs: AlgoTransaction[],
    overrides: Record<string, unknown> = {},
): SignRequest =>
    ({
        id: 'REQ-1',
        type: 'transactions',
        transport: 'algod',
        sourceType: 'multisig-cosign',
        txs,
        ...overrides,
    }) as SignRequest

describe('deriveRequestGroupTxIds', () => {
    it('derives the submit-time txids of an ungrouped request', () => {
        const txs = makeGroup()
        const expected = submitTimeTxIds(txs)

        const derived = deriveRequestGroupTxIds(txs)
        expect(derived).toEqual(expected)
        // The originals must not be mutated.
        expect(txs.every(txn => txn.group === undefined)).toBe(true)
    })

    it('keeps the txids as-is when the group is already set consistently', () => {
        const txs = makeGroup()
        const groupId = computeGroupID(txs)
        for (const txn of txs) txn.group = groupId

        const derived = deriveRequestGroupTxIds(txs)
        expect(derived).toEqual(txs.map(txn => txn.txID()))
    })

    it('returns no txids for an empty request', () => {
        expect(deriveRequestGroupTxIds([])).toEqual([])
    })
})

describe('isRequestGroupAlreadySubmitted', () => {
    let db: Database
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        await runMigrations(db, migrations)
    })

    afterEach(() => {
        teardown()
    })

    it('is true when the group has an open ledger row', async () => {
        const txs = makeGroup()
        const txIds = submitTimeTxIds(txs)
        await recordSubmissionAttempt({
            db,
            network: 'mainnet',
            txIds,
            flow: 'generic',
        })

        const submitted = await isRequestGroupAlreadySubmitted(
            makeTransactionSignRequest(txs),
            { db },
        )
        expect(submitted).toBe(true)
    })

    it('is false when the group only has resolved rows', async () => {
        const txs = makeGroup()
        const txIds = submitTimeTxIds(txs)
        const id = await recordSubmissionAttempt({
            db,
            network: 'mainnet',
            txIds,
            flow: 'generic',
        })
        await resolveSubmissionAttempt({ db, id, status: 'confirmed' })

        const submitted = await isRequestGroupAlreadySubmitted(
            makeTransactionSignRequest(txs),
            { db },
        )
        expect(submitted).toBe(false)
    })

    it('is false for non-transaction requests and empty groups', async () => {
        expect(
            await isRequestGroupAlreadySubmitted({
                id: 'REQ-2',
                type: 'arbitrary-data',
                transport: 'algod',
                data: [],
            } as SignRequest),
        ).toBe(false)
        expect(
            await isRequestGroupAlreadySubmitted(
                makeTransactionSignRequest([]),
            ),
        ).toBe(false)
    })

    it('fails open (false) when the database is unavailable', async () => {
        const txs = makeGroup()
        // No db initialized — getDatabase() throws inside the guard.
        const submitted = await isRequestGroupAlreadySubmitted(
            makeTransactionSignRequest(txs),
        )
        expect(submitted).toBe(false)
    })
})
