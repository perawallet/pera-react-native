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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    migrations,
    runMigrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import {
    DuplicateTransactionBatchError,
    findTransactionBatch,
    getRunningTransactionBatches,
    getTransactionBatch,
    recordTransactionBatch,
    updateTransactionBatch,
} from '..'
import {
    getReviewApproval,
    recordReviewApproval,
    retireReviewApproval,
} from '../repository'

const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' } as const
const SEPOLIA = { chainId: 'ethereum', networkId: 'sepolia' } as const
const ALGORAND = { chainId: 'algorand', networkId: 'mainnet' } as const
const SENDER = '0x1111111111111111111111111111111111111111'
const OTHER_SENDER = '0x2222222222222222222222222222222222222222'
const PAYLOAD = { calls: [{ to: '0xabc', value: '0', data: '0x' }] }

describe('transaction batches', () => {
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

    const record = (
        overrides: Partial<{ sender: string; batchId: string }> = {},
    ) =>
        recordTransactionBatch({
            db,
            scope: ETHEREUM,
            sender: SENDER,
            batchId: 'batch-1',
            approvalToken: 'approval-1',
            payload: PAYLOAD,
            txIds: ['0xhash1'],
            signedRaw: '0xsigned1',
            ...overrides,
        })

    it('Given a recorded batch, when it is found by id and sender, then it reads back running at position 0', async () => {
        const recorded = await record()

        const found = await findTransactionBatch({
            db,
            chainId: 'ethereum',
            batchId: 'batch-1',
            senders: [OTHER_SENDER, SENDER],
        })

        expect(found).toEqual(recorded)
        expect(found).toMatchObject({
            scope: ETHEREUM,
            approvalToken: 'approval-1',
            payload: PAYLOAD,
            txIds: ['0xhash1'],
            signedRaw: '0xsigned1',
            position: 0,
            outcome: 'running',
        })
    })

    it('Given a batch, when it is looked up for another sender or chain, then it is not found', async () => {
        await record()

        expect(
            await findTransactionBatch({
                db,
                chainId: 'ethereum',
                batchId: 'batch-1',
                senders: [OTHER_SENDER],
            }),
        ).toBeNull()
        expect(
            await findTransactionBatch({
                db,
                chainId: 'algorand',
                batchId: 'batch-1',
                senders: [SENDER],
            }),
        ).toBeNull()
    })

    it('Given a recorded batch, when read by its row id, then the current row comes back, and null for an unknown id', async () => {
        const recorded = await record()
        await updateTransactionBatch({
            db,
            id: recorded.id,
            txIds: recorded.txIds,
            signedRaw: null,
            position: 0,
            outcome: 'confirmed',
        })

        expect(
            await getTransactionBatch({ db, id: recorded.id }),
        ).toMatchObject({ outcome: 'confirmed', signedRaw: null })
        expect(await getTransactionBatch({ db, id: 'unknown' })).toBeNull()
    })

    it('Given a batch on one chain, when looked up with no chain named, then it is found, as ids are unique per sender', async () => {
        const recorded = await record()

        expect(
            await findTransactionBatch({
                db,
                batchId: 'batch-1',
                senders: [SENDER],
            }),
        ).toEqual(recorded)
    })

    it('Given a batch id the sender already used, when another is recorded, then it throws a duplicate error', async () => {
        await record()

        await expect(record()).rejects.toBeInstanceOf(
            DuplicateTransactionBatchError,
        )
    })

    it('Given a batch id one sender used, when another sender records it, then both exist', async () => {
        await record()

        await expect(record({ sender: OTHER_SENDER })).resolves.toMatchObject({
            sender: OTHER_SENDER,
        })
    })

    it('Given a running batch, when it is updated, then the hashes, position and outcome are kept', async () => {
        const { id } = await record()

        await updateTransactionBatch({
            db,
            id,
            txIds: ['0xhash1', '0xhash2'],
            signedRaw: null,
            position: 1,
            outcome: 'reverted',
        })

        expect(
            await findTransactionBatch({
                db,
                chainId: 'ethereum',
                batchId: 'batch-1',
                senders: [SENDER],
            }),
        ).toMatchObject({
            txIds: ['0xhash1', '0xhash2'],
            signedRaw: null,
            position: 1,
            outcome: 'reverted',
        })
    })

    it('Given batches in several states and chains, when the running ones are read, then only that chain running ones come back, oldest first', async () => {
        const first = await record({ batchId: 'a' })
        const settled = await record({ batchId: 'b' })
        await updateTransactionBatch({
            db,
            id: settled.id,
            txIds: settled.txIds,
            signedRaw: null,
            position: 0,
            outcome: 'confirmed',
        })
        const onTestnet = await recordTransactionBatch({
            db,
            scope: SEPOLIA,
            sender: SENDER,
            batchId: 'c',
            approvalToken: 'approval-c',
            payload: PAYLOAD,
            txIds: [],
        })
        await recordTransactionBatch({
            db,
            scope: ALGORAND,
            sender: 'ALGO',
            batchId: 'd',
            approvalToken: 'approval-d',
            payload: PAYLOAD,
            txIds: [],
        })

        const running = await getRunningTransactionBatches({
            db,
            chainId: 'ethereum',
        })

        expect(running.map(batch => batch.id)).toEqual([first.id, onTestnet.id])
    })

    it('Given an approved review, when it is read back by its token, then its transactions keep their bigints and Decimals', async () => {
        const transactions = [
            {
                scope: ETHEREUM,
                payload: { from: SENDER, transaction: { value: 10n ** 30n } },
                summary: { kind: 'transfer', amount: new Decimal('1.5') },
                chainData: { family: 'evm' },
            },
        ] as never

        const token = await recordReviewApproval({
            db,
            scope: ETHEREUM,
            transactions,
        })

        expect(await getReviewApproval({ db, token })).toEqual({
            scope: ETHEREUM,
            transactions,
            createdAt: expect.any(Number),
        })
        expect(await getReviewApproval({ db, token: 'unknown' })).toBeNull()
    })

    it('Given an approval, when it is retired, then it can no longer be read', async () => {
        const token = await recordReviewApproval({
            db,
            scope: ETHEREUM,
            transactions: [],
        })

        await retireReviewApproval({ db, token })

        expect(await getReviewApproval({ db, token })).toBeNull()
    })
})
