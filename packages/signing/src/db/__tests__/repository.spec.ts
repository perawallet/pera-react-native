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
import { eq } from 'drizzle-orm'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import {
    recordSubmissionAttempt,
    resolveSubmissionAttempt,
    markSubmissionUnknown,
    getOpenSubmissionAttempts,
    getOpenSubmissionAttemptsForIntent,
    getSubmissionAttemptsByTxIds,
    pruneResolvedSubmissionAttempts,
} from '..'
import { SubmissionAttemptsSchema } from '../schema'

describe('submission ledger repository', () => {
    let db: Database
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        await runMigrations(db, migrations)
    })

    /** Ages a row so retention windows are exercisable without fake timers. */
    const backdate = async (id: string, createdAt: number): Promise<void> => {
        await db
            .update(SubmissionAttemptsSchema)
            .set({ createdAt, resolvedAt: createdAt })
            .where(eq(SubmissionAttemptsSchema.id, id))
            .run()
    }

    afterEach(() => {
        teardown()
    })

    const recordRekey = (
        overrides: Partial<Parameters<typeof recordSubmissionAttempt>[0]> = {},
    ) =>
        recordSubmissionAttempt({
            db,
            network: 'mainnet',
            txIds: ['TXID-REKEY-1'],
            flow: 'rekey',
            intentKey: { kind: 'rekey', address: 'SENDER_A' },
            sender: 'SENDER_A',
            lastValid: 2000,
            ...overrides,
        })

    it('records a row and resolves it to confirmed', async () => {
        const id = await recordRekey()

        const open = await getOpenSubmissionAttempts({ db })
        expect(open).toHaveLength(1)
        expect(open[0]).toMatchObject({
            id,
            network: 'mainnet',
            txIds: ['TXID-REKEY-1'],
            intentKey: { kind: 'rekey', address: 'SENDER_A' },
            flow: 'rekey',
            sender: 'SENDER_A',
            status: 'submitted',
            lastValid: 2000,
            resolvedAt: null,
        })

        await resolveSubmissionAttempt({ db, id, status: 'confirmed' })

        const after = await getOpenSubmissionAttempts({ db })
        expect(after).toHaveLength(0)
        // Terminal rows are not open — the txid query only surfaces open ones.
        const byTxId = await getSubmissionAttemptsByTxIds({
            db,
            txIds: ['TXID-REKEY-1'],
        })
        expect(byTxId).toHaveLength(0)
    })

    it('marks an unknown-outcome row open for the reconciler', async () => {
        const id = await recordRekey()
        await markSubmissionUnknown({ db, id })

        const open = await getOpenSubmissionAttempts({ db })
        expect(open).toHaveLength(1)
        expect(open[0]!.status).toBe('unknown')
        expect(open[0]!.resolvedAt).toBeNull()
    })

    it('resolves to failed with a resolvedAt stamp', async () => {
        const id = await recordRekey()
        await resolveSubmissionAttempt({ db, id, status: 'failed' })

        const rows = await db.select().from(SubmissionAttemptsSchema).all()
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ status: 'failed' })
        expect(
            (rows[0] as { resolvedAt: number | null }).resolvedAt,
        ).not.toBeNull()
    })

    it('filters open rows by network', async () => {
        await recordRekey()
        await recordRekey({ network: 'testnet', txIds: ['TXID-TESTNET'] })

        const mainnet = await getOpenSubmissionAttempts({
            db,
            network: 'mainnet',
        })
        expect(mainnet).toHaveLength(1)
        expect(mainnet[0]!.network).toBe('mainnet')
    })

    it('filters open rows by sender', async () => {
        await recordRekey()
        await recordRekey({
            txIds: ['TXID-REKEY-B'],
            intentKey: { kind: 'rekey', address: 'SENDER_B' },
            sender: 'SENDER_B',
        })

        // History renders per account: scoping in SQL avoids scanning every
        // account's attempts on each first-page fetch.
        const mine = await getOpenSubmissionAttempts({
            db,
            sender: 'SENDER_A',
        })
        expect(mine).toHaveLength(1)
        expect(mine[0]!.sender).toBe('SENDER_A')
    })

    it('prunes resolved rows past the retention window, keeping open ones', async () => {
        const staleId = await recordRekey({ txIds: ['TXID-STALE'] })
        await resolveSubmissionAttempt({ db, id: staleId, status: 'confirmed' })
        const openId = await recordRekey({ txIds: ['TXID-OPEN'] })
        await backdate(staleId, 0)
        await backdate(openId, 0)

        const deleted = await pruneResolvedSubmissionAttempts({
            db,
            olderThanMs: 1,
        })

        expect(deleted).toBe(1)
        const remaining = await db.select().from(SubmissionAttemptsSchema).all()
        expect(remaining).toHaveLength(1)
        expect((remaining[0] as { id: string }).id).toBe(openId)
    })

    it('measures the retention window from resolution, not creation', async () => {
        const id = await recordRekey({ txIds: ['TXID-LONG-OPEN'] })
        await resolveSubmissionAttempt({ db, id, status: 'failed' })
        // Stayed open for a long time, then resolved a moment ago. Sweeping
        // on createdAt would drop it immediately and shrink the
        // sign-request guard's protection window to nothing.
        await db
            .update(SubmissionAttemptsSchema)
            .set({ createdAt: 0, resolvedAt: Date.now() })
            .where(eq(SubmissionAttemptsSchema.id, id))
            .run()

        const deleted = await pruneResolvedSubmissionAttempts({
            db,
            olderThanMs: 60_000,
        })

        expect(deleted).toBe(0)
        const remaining = await db.select().from(SubmissionAttemptsSchema).all()
        expect(remaining).toHaveLength(1)
    })

    it('matches open attempts by sender + intent key only', async () => {
        await recordRekey()
        await recordRekey({
            txIds: ['TXID-REKEY-2'],
            intentKey: { kind: 'rekey', address: 'SENDER_B' },
            sender: 'SENDER_B',
        })

        const matches = await getOpenSubmissionAttemptsForIntent({
            db,
            sender: 'SENDER_A',
            intentKey: { kind: 'rekey', address: 'SENDER_A' },
        })
        expect(matches).toHaveLength(1)
        expect(matches[0]!.txIds).toEqual(['TXID-REKEY-1'])
    })

    it('stops matching once the attempt is resolved', async () => {
        const id = await recordRekey()
        await resolveSubmissionAttempt({ db, id, status: 'failed' })

        const matches = await getOpenSubmissionAttemptsForIntent({
            db,
            sender: 'SENDER_A',
            intentKey: { kind: 'rekey', address: 'SENDER_A' },
        })
        expect(matches).toHaveLength(0)
    })

    it('finds open rows by any overlapping txid', async () => {
        await recordRekey()
        await recordSubmissionAttempt({
            db,
            network: 'mainnet',
            txIds: ['TXID-GROUP-2'],
            flow: 'generic',
        })

        const matches = await getSubmissionAttemptsByTxIds({
            db,
            txIds: ['TXID-GROUP-2', 'UNRELATED'],
        })
        expect(matches).toHaveLength(1)
        expect(matches[0]!.txIds).toEqual(['TXID-GROUP-2'])
    })

    it('returns nothing for an empty txid query', async () => {
        await recordRekey()
        const matches = await getSubmissionAttemptsByTxIds({
            db,
            txIds: [],
        })
        expect(matches).toHaveLength(0)
    })
})
