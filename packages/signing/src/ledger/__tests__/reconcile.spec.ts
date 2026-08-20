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
    markSubmissionUnknown,
    reconcileOpenSubmissions,
    probeSubmissionAttempt,
    setSubmissionSettledHandler,
} from '..'
import { SubmissionAttemptsSchema } from '../schema'
import type { SubmissionAttempt } from '../types'
import type { SubmissionProbeClient } from '../reconcile'

type PendingResponse = Record<string, unknown>

const makeClient = ({
    pending,
    pendingError,
    indexer,
    indexerError,
    lastRound = 10,
    statusError,
}: {
    pending?: PendingResponse
    pendingError?: Error
    indexer?: unknown
    indexerError?: Error
    lastRound?: number
    statusError?: Error
} = {}): SubmissionProbeClient => ({
    client: {
        algod: {
            pendingTransactionInformation: () => ({
                do: () =>
                    pendingError
                        ? Promise.reject(pendingError)
                        : Promise.resolve(pending ?? {}),
            }),
            status: () => ({
                do: () =>
                    statusError
                        ? Promise.reject(statusError)
                        : Promise.resolve({ 'last-round': lastRound }),
            }),
        },
        indexer: {
            lookupTransactionByID: () => ({
                do: () =>
                    indexerError
                        ? Promise.reject(indexerError)
                        : Promise.resolve(indexer ?? {}),
            }),
        },
    },
})

describe('submission reconciler', () => {
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
        setSubmissionSettledHandler('cosign', null)
    })

    const record = async (
        overrides: Partial<Parameters<typeof recordSubmissionAttempt>[0]> = {},
    ) =>
        recordSubmissionAttempt({
            db,
            network: 'mainnet',
            txIds: ['TXID-1'],
            flow: 'cosign',
            lastValid: 100,
            ...overrides,
        })

    const attemptFrom = (id: string): SubmissionAttempt => ({
        id,
        network: 'mainnet',
        txIds: ['TXID-1'],
        intentKey: null,
        flow: 'cosign',
        sender: null,
        bytesHash: 'TXID-1',
        signedBytesBase64: null,
        status: 'submitted',
        firstValid: 1,
        lastValid: 100,
        createdAt: 0,
        resolvedAt: null,
    })

    it('confirms a row whose transaction is committed on algod', async () => {
        const id = await record()
        const outcome = await probeSubmissionAttempt(
            attemptFrom(id),
            makeClient({ pending: { 'confirmed-round': 42 } }),
        )
        expect(outcome).toBe('confirmed')
    })

    it('reads the real algosdk camelCase shape (schema-decoded response)', async () => {
        const id = await record()
        // algosdk decodes the wire msgpack into camelCase fields.
        const outcome = await probeSubmissionAttempt(
            attemptFrom(id),
            makeClient({
                pending: { confirmedRound: 42n, poolError: '' },
            }),
        )
        expect(outcome).toBe('confirmed')
    })

    it('detects a pool-error in the algosdk camelCase shape', async () => {
        const id = await record()
        const outcome = await probeSubmissionAttempt(
            attemptFrom(id),
            makeClient({ pending: { poolError: 'overspend' } }),
        )
        expect(outcome).toBe('failed')
    })

    it('leaves a row open while the transaction is in the pool', async () => {
        const id = await record()
        const outcome = await probeSubmissionAttempt(
            attemptFrom(id),
            makeClient({ pending: { 'in-pool': true } }),
        )
        expect(outcome).toBeNull()
    })

    it('resolves a pool-error to failed (the node refused the bytes)', async () => {
        const id = await record()
        const outcome = await probeSubmissionAttempt(
            attemptFrom(id),
            makeClient({ pending: { 'pool-error': 'overspend' } }),
        )
        expect(outcome).toBe('failed')
    })

    it('confirms via the indexer when algod no longer tracks the tx', async () => {
        const id = await record()
        const outcome = await probeSubmissionAttempt(
            attemptFrom(id),
            makeClient({
                pendingError: new Error('transaction not found'),
                indexer: { 'confirmed-round': 42 },
            }),
        )
        expect(outcome).toBe('confirmed')
    })

    it('resolves failed once lastValid has passed with nothing landed', async () => {
        const id = await record()
        const outcome = await probeSubmissionAttempt(
            attemptFrom(id),
            makeClient({
                pendingError: new Error('not found'),
                indexerError: new Error('not found'),
                lastRound: 101,
            }),
        )
        expect(outcome).toBe('failed')
    })

    it('leaves a row open before lastValid expires with nothing found', async () => {
        const id = await record()
        const outcome = await probeSubmissionAttempt(
            attemptFrom(id),
            makeClient({
                pendingError: new Error('not found'),
                indexerError: new Error('not found'),
                lastRound: 50,
            }),
        )
        expect(outcome).toBeNull()
    })

    it('leaves a row without a txid open (nothing to probe)', async () => {
        const id = await record({ txIds: [] })
        const outcome = await probeSubmissionAttempt(
            { ...attemptFrom(id), txIds: [] },
            makeClient(),
        )
        expect(outcome).toBeNull()
    })

    it('resolves settled rows in the database and invokes the flow handler', async () => {
        const id = await record()
        const settled: Array<{ txIds: string[]; status: string }> = []
        setSubmissionSettledHandler('cosign', (txIds, _network, status) => {
            settled.push({ txIds, status })
        })

        const summary = await reconcileOpenSubmissions({
            db,
            getClient: () => makeClient({ pending: { 'confirmed-round': 42 } }),
        })

        expect(summary).toEqual({ probed: 1, confirmed: 1, failed: 0 })
        expect(settled).toEqual([{ txIds: ['TXID-1'], status: 'confirmed' }])

        const rows = await db.select().from(SubmissionAttemptsSchema).all()
        expect(rows[0]).toMatchObject({ status: 'confirmed' })
    })

    it('resolves unknown-status rows too (left open by a lost-ack submit)', async () => {
        const id = await record()
        await markSubmissionUnknown({ db, id })

        const summary = await reconcileOpenSubmissions({
            db,
            getClient: () =>
                makeClient({
                    pendingError: new Error('not found'),
                    indexerError: new Error('not found'),
                    lastRound: 101,
                }),
        })

        expect(summary).toEqual({ probed: 1, confirmed: 0, failed: 1 })
    })

    it('is a no-op when no open rows exist', async () => {
        const summary = await reconcileOpenSubmissions({ db })
        expect(summary).toEqual({ probed: 0, confirmed: 0, failed: 0 })
    })

    it('leaves rows open when the probe itself fails', async () => {
        const id = await record()
        const summary = await reconcileOpenSubmissions({
            db,
            getClient: () =>
                makeClient({
                    pendingError: new Error('network down'),
                    indexerError: new Error('network down'),
                    statusError: new Error('network down'),
                }),
        })

        expect(summary).toEqual({ probed: 0, confirmed: 0, failed: 0 })

        const rows = await db.select().from(SubmissionAttemptsSchema).all()
        expect(rows[0]).toMatchObject({ status: 'submitted' })
    })
})
