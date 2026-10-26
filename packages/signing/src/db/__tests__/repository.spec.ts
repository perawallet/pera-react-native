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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { eq, sql } from 'drizzle-orm'
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
    getSubmissionAttemptsAtNonce,
    getSubmissionAttemptsWithHistoryEntry,
    getReplaceableSubmissionAttempt,
    getUnsyncedSubmissionSpends,
    pruneResolvedSubmissionAttempts,
    subscribeToSubmissionLedger,
    LANDABLE_SUBMISSION_STATUSES,
} from '..'
import { SubmissionAttemptsSchema } from '../schema'
import type { SubmissionHistoryEntry } from '../types'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' } as const

const HISTORY_ENTRY: SubmissionHistoryEntry = {
    summary: {
        kind: 'transfer',
        title: { key: 'transactions.list_item.send' },
        direction: 'out',
        amount: {
            assetRef: { chainId: 'ethereum', assetId: 'native' },
            value: new Decimal('1500000000000000000'),
        },
        balanceChanges: [
            {
                assetRef: { chainId: 'ethereum', assetId: 'native' },
                value: new Decimal('-1500000000000000000'),
            },
        ],
        icon: 'send',
    },
    chainData: { family: 'evm' },
    fee: new Decimal('420000000000000'),
}

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
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            txIds: ['TXID-REKEY-1'],
            flow: 'rekey',
            intentKey: { kind: 'rekey', address: 'SENDER_A' },
            sender: 'SENDER_A',
            chainData: { family: 'algorand', lastValid: 2000 },
            ...overrides,
        })

    it('records a row and resolves it to confirmed', async () => {
        const id = await recordRekey()

        const open = await getOpenSubmissionAttempts({ db })
        expect(open).toHaveLength(1)
        expect(open[0]).toMatchObject({
            id,
            network: 'algorand/mainnet',
            txIds: ['TXID-REKEY-1'],
            intentKey: { kind: 'rekey', address: 'SENDER_A' },
            flow: 'rekey',
            sender: 'SENDER_A',
            status: 'submitted',
            chainData: { family: 'algorand', lastValid: 2000 },
            resolvedAt: null,
        })

        await resolveSubmissionAttempt({ db, id, status: 'confirmed' })

        const after = await getOpenSubmissionAttempts({ db })
        expect(after).toHaveLength(0)
        // Terminal rows are not open — the txid query only surfaces open ones.
        const byTxId = await getSubmissionAttemptsByTxIds({
            db,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
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
        await recordRekey({
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const,
            txIds: ['TXID-TESTNET'],
        })

        const mainnet = await getOpenSubmissionAttempts({
            db,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        expect(mainnet).toHaveLength(1)
        expect(mainnet[0]!.network).toBe('algorand/mainnet')
    })

    it('returns every network when no scope is given', async () => {
        await recordRekey()
        await recordRekey({
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const,
            txIds: ['TXID-TESTNET'],
        })

        expect(await getOpenSubmissionAttempts({ db })).toHaveLength(2)
    })

    it('stores the scope key the backfill migration wrote', async () => {
        await recordRekey({
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const,
        })

        const rows = (await db.all(
            sql.raw('select scope from submission_attempts'),
        )) as Array<[string]>
        expect(rows.map(([network]) => network)).toEqual(['algorand/testnet'])
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

    it('drops only unevaluatable stale rows from the guard lookup', async () => {
        // No validity window: the reconciler can never prove this either way,
        // so past the bound it must stop blocking new activity.
        const unevaluatableId = await recordRekey({
            txIds: ['TXID-NO-WINDOW'],
            chainData: undefined,
        })
        await db
            .update(SubmissionAttemptsSchema)
            .set({ createdAt: Date.now() - 2 * 60 * 60 * 1000 })
            .where(eq(SubmissionAttemptsSchema.id, unevaluatableId))
            .run()

        const open = await getOpenSubmissionAttempts({ db })
        expect(open).toHaveLength(1)

        const blocking = await getOpenSubmissionAttempts({
            db,
            unevaluatableBefore: Date.now() - 60 * 60 * 1000,
        })
        expect(blocking).toHaveLength(0)
    })

    it('keeps an equally old row that still carries a validity window', async () => {
        // Rounds are not wall-clock: on a slow-block network a 1000-round
        // window outlives an hour, so ageing this row out would reopen the
        // double-spend window the guard exists to close.
        const liveId = await recordRekey({ txIds: ['TXID-STILL-LIVE'] })
        await db
            .update(SubmissionAttemptsSchema)
            .set({ createdAt: Date.now() - 2 * 60 * 60 * 1000 })
            .where(eq(SubmissionAttemptsSchema.id, liveId))
            .run()

        const blocking = await getOpenSubmissionAttempts({
            db,
            unevaluatableBefore: Date.now() - 60 * 60 * 1000,
        })
        expect(blocking).toHaveLength(1)
        expect(blocking[0]!.id).toBe(liveId)
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
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            txIds: ['TXID-GROUP-2'],
            flow: 'generic',
        })

        const matches = await getSubmissionAttemptsByTxIds({
            db,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            txIds: ['TXID-GROUP-2', 'UNRELATED'],
        })
        expect(matches).toHaveLength(1)
        expect(matches[0]!.txIds).toEqual(['TXID-GROUP-2'])
    })

    it('finds only the attempts recorded under the queried scope', async () => {
        await recordSubmissionAttempt({
            db,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            txIds: ['TXID-SHARED'],
            flow: 'generic',
        })
        const testnetId = await recordSubmissionAttempt({
            db,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const,
            txIds: ['TXID-SHARED'],
            flow: 'generic',
        })

        const matches = await getSubmissionAttemptsByTxIds({
            db,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const,
            txIds: ['TXID-SHARED'],
        })
        expect(matches.map(match => match.id)).toEqual([testnetId])
    })

    it('returns nothing for an empty txid query', async () => {
        await recordRekey()
        const matches = await getSubmissionAttemptsByTxIds({
            db,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            txIds: [],
        })
        expect(matches).toHaveLength(0)
    })

    it('round-trips the nonce, and stores null when omitted', async () => {
        const withNonce = await recordRekey({ nonce: 7 })
        const without = await recordRekey()

        const open = await getOpenSubmissionAttempts({ db })
        expect(open.find(row => row.id === withNonce)!.nonce).toBe(7)
        expect(open.find(row => row.id === without)!.nonce).toBeNull()
    })

    it('treats a replaced row as terminal and not landable', async () => {
        const id = await recordRekey()

        await resolveSubmissionAttempt({ db, id, status: 'replaced' })

        expect(await getOpenSubmissionAttempts({ db })).toHaveLength(0)
        const byTxId = await getSubmissionAttemptsByTxIds({
            db,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            txIds: ['TXID-REKEY-1'],
            statuses: LANDABLE_SUBMISSION_STATUSES,
        })
        expect(byTxId).toHaveLength(0)
    })

    it('scopes open rows to one chain by its scope-key prefix', async () => {
        await recordRekey()
        const ethereumId = await recordSubmissionAttempt({
            db,
            scope: { chainId: 'ethereum', networkId: 'mainnet' },
            txIds: ['0xabc'],
            flow: 'pipeline',
        })

        const rows = await getOpenSubmissionAttempts({
            db,
            chainId: 'ethereum',
        })

        expect(rows.map(row => row.id)).toEqual([ethereumId])
    })

    describe('history entry', () => {
        const recordWithEntry = (
            overrides: Partial<
                Parameters<typeof recordSubmissionAttempt>[0]
            > = {},
        ) =>
            recordSubmissionAttempt({
                db,
                scope: ETHEREUM,
                txIds: ['0xabc'],
                flow: 'pipeline',
                sender: '0xSENDER',
                historyEntry: HISTORY_ENTRY,
                ...overrides,
            })

        it('reads the entry back with every Decimal intact', async () => {
            await recordWithEntry()

            const [attempt] = await getSubmissionAttemptsWithHistoryEntry({
                db,
                scope: ETHEREUM,
            })

            const entry = attempt!.historyEntry
            expect(entry.summary.amount!.value).toBeInstanceOf(Decimal)
            expect(entry.summary.amount!.value.eq('1500000000000000000')).toBe(
                true,
            )
            expect(entry.summary.balanceChanges![0]!.value).toBeInstanceOf(
                Decimal,
            )
            expect(entry.summary.balanceChanges![0]!.value.toString()).toBe(
                '-1500000000000000000',
            )
            expect(entry.fee).toBeInstanceOf(Decimal)
            expect(entry.fee!.toString()).toBe('420000000000000')
            expect(entry.chainData).toEqual({ family: 'evm' })
        })

        it.each([
            ['unparseable text', 'not json'],
            [
                'an entry of another version',
                JSON.stringify({ v: 0, entry: { summary: {} } }),
            ],
        ])(
            'skips %s and still serves the open-attempt read',
            async (_label, historyEntryJson) => {
                const id = await recordWithEntry()
                await db
                    .update(SubmissionAttemptsSchema)
                    .set({ historyEntryJson })
                    .where(eq(SubmissionAttemptsSchema.id, id))
                    .run()

                expect(
                    await getSubmissionAttemptsWithHistoryEntry({
                        db,
                        scope: ETHEREUM,
                    }),
                ).toEqual([])
                expect(
                    (await getOpenSubmissionAttempts({ db })).map(
                        row => row.id,
                    ),
                ).toEqual([id])
            },
        )

        it('returns entry-bearing rows of every status for the scope, newest first', async () => {
            const statuses = [
                'submitted',
                'unknown',
                'confirmed',
                'failed',
                'replaced',
            ] as const
            const ids: string[] = []
            for (const [index, status] of statuses.entries()) {
                const id = await recordWithEntry({ txIds: [`0x${index}`] })
                if (status === 'unknown')
                    await markSubmissionUnknown({ db, id })
                if (
                    status === 'confirmed' ||
                    status === 'failed' ||
                    status === 'replaced'
                ) {
                    await resolveSubmissionAttempt({ db, id, status })
                }
                await backdate(id, 1_000 + index)
                ids.push(id)
            }
            await recordWithEntry({ historyEntry: undefined })
            await recordWithEntry({
                scope: { chainId: 'ethereum', networkId: 'sepolia' },
            })

            const rows = await getSubmissionAttemptsWithHistoryEntry({
                db,
                scope: ETHEREUM,
            })

            expect(rows.map(row => row.id).sort()).toEqual([...ids].sort())
            expect(rows.map(row => row.createdAt)).toEqual([
                1_004, 1_003, 1_002, 1_001, 1_000,
            ])
            expect(rows.map(row => row.status).sort()).toEqual(
                [...statuses].sort(),
            )
        })
    })

    describe('unsynced spends', () => {
        const record = (
            overrides: Partial<
                Parameters<typeof recordSubmissionAttempt>[0]
            > = {},
        ) =>
            recordSubmissionAttempt({
                db,
                scope: ETHEREUM,
                txIds: ['0xabc'],
                flow: 'pipeline',
                sender: '0xSENDER',
                nonce: 7,
                maxFee: new Decimal('420000000000000'),
                historyEntry: HISTORY_ENTRY,
                ...overrides,
            })

        it('reads back the nonce, max fee and entry of an open attempt', async () => {
            await record()

            const [spend] = await getUnsyncedSubmissionSpends({
                db,
                scope: ETHEREUM,
            })

            expect(spend!.nonce).toBe(7)
            expect(spend!.maxFee).toBeInstanceOf(Decimal)
            expect(spend!.maxFee!.toString()).toBe('420000000000000')
            expect(spend!.historyEntry!.summary.amount!.value.toString()).toBe(
                '1500000000000000000',
            )
        })

        it('keeps the max fee of an attempt with no or an unreadable entry', async () => {
            await record({ historyEntry: undefined })
            const unreadable = await record({ txIds: ['0xdef'] })
            await db
                .update(SubmissionAttemptsSchema)
                .set({ historyEntryJson: 'not json' })
                .where(eq(SubmissionAttemptsSchema.id, unreadable))
                .run()

            const spends = await getUnsyncedSubmissionSpends({
                db,
                scope: ETHEREUM,
            })

            expect(spends).toHaveLength(2)
            for (const spend of spends) {
                expect(spend.historyEntry).toBeNull()
                expect(spend.maxFee!.toString()).toBe('420000000000000')
            }
        })

        it('returns the open attempts of the scope and the confirmed ones with a nonce', async () => {
            const submitted = await record({ txIds: ['0x1'] })
            const unknown = await record({ txIds: ['0x2'] })
            await markSubmissionUnknown({ db, id: unknown })
            const settled: Record<string, string> = {}
            for (const status of ['confirmed', 'failed', 'replaced'] as const) {
                const id = await record({ txIds: [`0x${status}`] })
                await resolveSubmissionAttempt({ db, id, status })
                settled[status] = id
            }
            const withoutNonce = await record({
                txIds: ['0xno-nonce'],
                nonce: undefined,
            })
            await resolveSubmissionAttempt({
                db,
                id: withoutNonce,
                status: 'confirmed',
            })
            await record({
                scope: { chainId: 'ethereum', networkId: 'sepolia' },
            })

            const spends = await getUnsyncedSubmissionSpends({
                db,
                scope: ETHEREUM,
            })

            expect(spends.map(spend => spend.id).sort()).toEqual(
                [submitted, unknown, settled.confirmed].sort(),
            )
        })

        it('notifies subscribers when an attempt opens or settles', async () => {
            const listener = vi.fn()
            const unsubscribe = subscribeToSubmissionLedger(listener)

            const id = await record()
            await markSubmissionUnknown({ db, id })
            await resolveSubmissionAttempt({ db, id, status: 'confirmed' })
            unsubscribe()
            await record({ txIds: ['0xafter'] })

            // Unknown stays open, so it changes nothing a reader holds back.
            expect(listener).toHaveBeenCalledTimes(2)
        })

        it('still records when a subscriber throws', async () => {
            const unsubscribe = subscribeToSubmissionLedger(() => {
                throw new Error('boom')
            })

            await expect(record()).resolves.toEqual(expect.any(String))
            unsubscribe()
        })
    })

    describe('replacement', () => {
        const record = (
            overrides: Partial<
                Parameters<typeof recordSubmissionAttempt>[0]
            > = {},
        ) =>
            recordSubmissionAttempt({
                db,
                scope: ETHEREUM,
                txIds: ['0xaaa'],
                flow: 'pipeline',
                sender: '0xSENDER',
                nonce: 7,
                rawTransaction: '0x02aaa',
                historyEntry: HISTORY_ENTRY,
                ...overrides,
            })

        it('reads back the raw transaction and the attempt it replaces', async () => {
            const original = await record()
            await record({
                txIds: ['0xbbb'],
                rawTransaction: '0x02bbb',
                replacesAttemptId: original,
            })

            const attempts = await getSubmissionAttemptsAtNonce({
                db,
                scope: ETHEREUM,
                sender: '0xSENDER',
                nonce: 7,
            })

            expect(
                attempts.map(a => [a.rawTransaction, a.replacesAttemptId]),
            ).toEqual([
                ['0x02aaa', null],
                ['0x02bbb', original],
            ])
        })

        it('reads an attempt at a sequence number by scope, sender, nonce and status', async () => {
            const kept = await record()
            await record({ txIds: ['0x1'], nonce: 8 })
            await record({ txIds: ['0x2'], sender: '0xOTHER' })
            await record({
                txIds: ['0x3'],
                scope: { chainId: 'ethereum', networkId: 'sepolia' },
            })
            const settled = await record({ txIds: ['0x4'] })
            await resolveSubmissionAttempt({
                db,
                id: settled,
                status: 'failed',
            })

            const open = await getSubmissionAttemptsAtNonce({
                db,
                scope: ETHEREUM,
                sender: '0xSENDER',
                nonce: 7,
                statuses: ['submitted', 'unknown'],
            })
            const all = await getSubmissionAttemptsAtNonce({
                db,
                scope: ETHEREUM,
                sender: '0xSENDER',
                nonce: 7,
            })

            expect(open.map(a => a.id)).toEqual([kept])
            expect(all.map(a => a.id)).toEqual([kept, settled])
        })

        it('offers an open attempt with its bytes and history entry', async () => {
            const id = await record()

            const attempt = await getReplaceableSubmissionAttempt({
                db,
                scope: ETHEREUM,
                txId: '0xaaa',
            })

            expect(attempt).toMatchObject({
                id,
                rawTransaction: '0x02aaa',
                nonce: 7,
            })
            expect(attempt!.historyEntry!.summary.kind).toBe('transfer')
        })

        it('offers no settled attempt, none without bytes and none superseded by a newer one', async () => {
            const settled = await record({ txIds: ['0xsettled'], nonce: 1 })
            await resolveSubmissionAttempt({
                db,
                id: settled,
                status: 'confirmed',
            })
            await record({
                txIds: ['0xbare'],
                nonce: 2,
                rawTransaction: undefined,
            })
            const original = await record({ txIds: ['0xold'], nonce: 3 })
            await record({
                txIds: ['0xnew'],
                nonce: 3,
                replacesAttemptId: original,
            })

            for (const txId of ['0xsettled', '0xbare', '0xold']) {
                await expect(
                    getReplaceableSubmissionAttempt({
                        db,
                        scope: ETHEREUM,
                        txId,
                    }),
                ).resolves.toBeNull()
            }
            await expect(
                getReplaceableSubmissionAttempt({
                    db,
                    scope: ETHEREUM,
                    txId: '0xnew',
                }),
            ).resolves.not.toBeNull()
        })
    })
})
