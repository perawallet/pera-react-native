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
    getOpenSubmissionAttemptsByTxIds,
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
            firstValid: 1000,
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
            firstValid: 1000,
            lastValid: 2000,
            resolvedAt: null,
        })

        await resolveSubmissionAttempt({ db, id, status: 'confirmed' })

        const after = await getOpenSubmissionAttempts({ db })
        expect(after).toHaveLength(0)
        // Terminal rows are not open — the txid query only surfaces open ones.
        const byTxId = await getOpenSubmissionAttemptsByTxIds({
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

        const matches = await getOpenSubmissionAttemptsByTxIds({
            db,
            txIds: ['TXID-GROUP-2', 'UNRELATED'],
        })
        expect(matches).toHaveLength(1)
        expect(matches[0]!.txIds).toEqual(['TXID-GROUP-2'])
    })

    it('returns nothing for an empty txid query', async () => {
        await recordRekey()
        const matches = await getOpenSubmissionAttemptsByTxIds({
            db,
            txIds: [],
        })
        expect(matches).toHaveLength(0)
    })

    it('retains the signed bytes base64 when provided', async () => {
        const bytes = new Uint8Array([1, 2, 3, 4])
        const id = await recordSubmissionAttempt({
            db,
            network: 'mainnet',
            txIds: ['TXID-BYTES'],
            flow: 'swap',
            signedBytes: bytes,
        })

        const rows = await getOpenSubmissionAttempts({ db })
        expect(rows).toHaveLength(1)
        expect(rows[0]!.signedBytesBase64).toBe(
            Buffer.from(bytes).toString('base64'),
        )
        expect(rows[0]!.id).toBe(id)
    })

    it('uses the first txid as the bytes hash', async () => {
        await recordRekey()
        const rows = await getOpenSubmissionAttempts({ db })
        expect(rows[0]!.bytesHash).toBe('TXID-REKEY-1')
    })
})
