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

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { hexToBytes, keccak256, type Hex, type RpcTransaction } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { logger } from '@perawallet/wallet-core-shared'
import {
    recordSubmissionAttempt,
    resolveSubmissionAttempt,
    SubmissionAttemptsSchema,
} from '@perawallet/wallet-core-signing'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import {
    EvmRpcErrorFixture,
    evmRpcHandlers,
    evmTransactionReceipt,
    type EvmRpcFixtures,
} from '../../blockchain/msw-handlers'
import { createEvmClient } from '../../blockchain/utils/createEvmClient'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'
import { SENDER, VIEM_TRANSFER_NONCE_0 } from '../../signing/__tests__/fixtures'
import { allocateEthereumNonce } from '../nonce-pool'
import {
    DROPPED_GRACE_MS,
    PROBE_FAILURE_ESCALATION_STREAK,
    reconcileEthereumSubmissions,
    type ProbeFailureStreaks,
    type SubmissionSettledHandlers,
} from '../reconcile'
import { ETHEREUM } from '../../__tests__/evm-chains'
import { submitAndRecordEthereumTransactions } from '../submission'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const HASH = `0x${'ab'.repeat(32)}` as Hex
const REAL_HASH = keccak256(VIEM_TRANSFER_NONCE_0)
const HELD_BY_NODE = { blockNumber: null } as unknown as RpcTransaction

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const getClient = (scope: ChainScope) =>
    createEvmClient(scope, testChainContext(), ETHEREUM)

const settleHandlers: SubmissionSettledHandlers = new Map()
const probeFailures: ProbeFailureStreaks = new Map()

// Keyed by block tag: `latest` is the mined count, `pending` the pool's.
const node = (
    responses: EvmRpcFixtures['responses'] & { latest?: number } = {},
) => {
    const { latest = 0, ...rest } = responses
    server.use(
        ...evmRpcHandlers({
            rpcUrl: TEST_RPC_URL,
            responses: {
                eth_getTransactionCount: params =>
                    `0x${(params[1] === 'latest' ? latest : 0).toString(16)}`,
                ...rest,
            },
        }),
    )
}

describe('reconcileEthereumSubmissions', () => {
    let db: Database
    let teardown: () => void

    beforeEach(async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        await runMigrations(db, migrations)
    })

    afterEach(() => {
        vi.useRealTimers()
        settleHandlers.clear()
        probeFailures.clear()
        teardown()
    })

    const record = (
        overrides: Partial<Parameters<typeof recordSubmissionAttempt>[0]> = {},
    ) =>
        recordSubmissionAttempt({
            db,
            scope: SCOPE,
            txIds: [HASH],
            flow: 'pipeline',
            sender: SENDER,
            nonce: 0,
            ...overrides,
        })

    const reconcile = (ledgerDb = db) =>
        reconcileEthereumSubmissions({
            chain: ETHEREUM,
            settleHandlers,
            probeFailures,
            getClient,
            db: ledgerDb,
        })
    const statuses = async () =>
        (await db.select().from(SubmissionAttemptsSchema).all()).map(
            row => row.status,
        )
    const pastGraceWindow = () =>
        vi.setSystemTime(Date.now() + DROPPED_GRACE_MS + 1)

    it('confirms a row whose transaction has a success receipt', async () => {
        await record()
        node({
            eth_getTransactionReceipt: evmTransactionReceipt({
                transactionHash: HASH,
            }),
        })

        await expect(reconcile()).resolves.toEqual({
            probed: 1,
            confirmed: 1,
            failed: 0,
        })
        expect(await statuses()).toEqual(['confirmed'])
    })

    it('fails a row whose transaction reverted', async () => {
        await record()
        node({
            eth_getTransactionReceipt: evmTransactionReceipt({
                transactionHash: HASH,
                status: '0x0',
            }),
        })

        await expect(reconcile()).resolves.toEqual({
            probed: 1,
            confirmed: 0,
            failed: 1,
        })
        expect(await statuses()).toEqual(['failed'])
    })

    it('marks a row replaced when its nonce was mined under another hash, and tells the flow it failed', async () => {
        const handler = vi.fn()
        settleHandlers.set('pipeline', handler)
        await record({ txIds: [HASH, `0x${'cd'.repeat(32)}`] })
        node({ latest: 1 })

        await expect(reconcile()).resolves.toEqual({
            probed: 1,
            confirmed: 0,
            failed: 1,
        })
        expect(await statuses()).toEqual(['replaced'])
        expect(handler).toHaveBeenCalledWith(
            [HASH, `0x${'cd'.repeat(32)}`],
            'mainnet',
            'failed',
        )
    })

    it('does not call a row replaced while the node still holds its hash', async () => {
        await record()
        node({ latest: 1, eth_getTransactionByHash: HELD_BY_NODE })

        await expect(reconcile()).resolves.toMatchObject({ failed: 0 })
        expect(await statuses()).toEqual(['submitted'])
    })

    it('leaves a row open while the node still holds the transaction', async () => {
        await record()
        node({ eth_getTransactionByHash: HELD_BY_NODE })
        pastGraceWindow()

        await expect(reconcile()).resolves.toEqual({
            probed: 1,
            confirmed: 0,
            failed: 0,
        })
        expect(await statuses()).toEqual(['submitted'])
    })

    it('does not treat a transaction the node has not surfaced yet as dropped inside the grace window', async () => {
        await record()
        node()

        await expect(reconcile()).resolves.toMatchObject({ failed: 0 })
        expect(await statuses()).toEqual(['submitted'])
    })

    it('fails a row the node does not know once the grace window has passed', async () => {
        await record()
        node()
        pastGraceWindow()

        await expect(reconcile()).resolves.toMatchObject({ failed: 1 })
        expect(await statuses()).toEqual(['failed'])
    })

    it.each([
        ['a 500', 500],
        ['a rate limit', 429],
    ])('leaves the row open and counts nothing on %s', async (_, status) => {
        await record()
        server.use(
            http.post(TEST_RPC_URL, () => new HttpResponse(null, { status })),
        )
        pastGraceWindow()

        await expect(reconcile()).resolves.toEqual({
            probed: 1,
            confirmed: 0,
            failed: 0,
        })
        expect(await statuses()).toEqual(['submitted'])
    })

    it('reads only Ethereum rows', async () => {
        await record({
            scope: { chainId: 'algorand', networkId: 'mainnet' },
            txIds: ['ALGOTX'],
        })
        const unused = vi.fn(getClient)

        await expect(
            reconcileEthereumSubmissions({
                chain: ETHEREUM,
                settleHandlers,
                probeFailures,
                getClient: unused,
                db,
            }),
        ).resolves.toEqual({ probed: 0, confirmed: 0, failed: 0 })
        expect(unused).not.toHaveBeenCalled()
    })

    it('lets the next send fill the nonce of a dropped one, and settles that send', async () => {
        await record({ txIds: [HASH] })
        node()
        pastGraceWindow()
        await reconcile()
        const allocate = () =>
            allocateEthereumNonce({
                client: getClient(SCOPE),
                scope: SCOPE,
                sender: SENDER,
                db,
            })

        await expect(allocate()).resolves.toBe(0)

        await submitAndRecordEthereumTransactions({
            client: getClient(SCOPE),
            chain: ETHEREUM,
            scope: SCOPE,
            signedTransactions: [hexToBytes(VIEM_TRANSFER_NONCE_0)],
            flow: 'pipeline',
            historyEntries: [],
            db,
        })
        await expect(allocate()).resolves.toBe(1)
        node({
            eth_getTransactionReceipt: evmTransactionReceipt({
                transactionHash: REAL_HASH,
            }),
        })

        await expect(reconcile()).resolves.toMatchObject({ confirmed: 1 })
        expect(await statuses()).toEqual(['failed', 'confirmed'])
    })

    describe('a replacement at the same nonce', () => {
        const ORIGINAL = `0x${'0a'.repeat(32)}` as Hex
        const REPLACEMENT = `0x${'0b'.repeat(32)}` as Hex

        const recordPair = async () => {
            const original = await record({ txIds: [ORIGINAL] })
            vi.setSystemTime(Date.now() + 1_000)
            const replacement = await record({
                txIds: [REPLACEMENT],
                replacesAttemptId: original,
            })
            return { original, replacement }
        }

        // The nonce is mined, and only `winner` has a receipt.
        const minedAs = (winner: Hex) =>
            node({
                latest: 1,
                eth_getTransactionReceipt: params =>
                    params[0] === winner
                        ? evmTransactionReceipt({ transactionHash: winner })
                        : null,
            })

        const statusOf = async (id: string) =>
            (await db.select().from(SubmissionAttemptsSchema).all()).find(
                row => row.id === id,
            )?.status

        it('marks the original replaced and the replacement confirmed when the replacement lands', async () => {
            const { original, replacement } = await recordPair()
            minedAs(REPLACEMENT)

            await reconcile()

            expect(await statusOf(original)).toBe('replaced')
            expect(await statusOf(replacement)).toBe('confirmed')
        })

        it('marks the original confirmed and the replacement failed when the original lands', async () => {
            const handler = vi.fn()
            settleHandlers.set('pipeline', handler)
            const { original, replacement } = await recordPair()
            minedAs(ORIGINAL)

            await reconcile()

            expect(await statusOf(original)).toBe('confirmed')
            expect(await statusOf(replacement)).toBe('failed')
            expect(handler).toHaveBeenCalledWith(
                [REPLACEMENT],
                'mainnet',
                'failed',
            )
        })

        it("reads each hash's receipt once per pass, though the loser's check reads its sibling's again", async () => {
            const { original, replacement } = await recordPair()
            const receiptReads: unknown[] = []
            node({
                latest: 1,
                eth_getTransactionReceipt: params => {
                    receiptReads.push(params[0])
                    return params[0] === ORIGINAL
                        ? evmTransactionReceipt({ transactionHash: ORIGINAL })
                        : null
                },
            })

            await reconcile()

            expect(await statusOf(original)).toBe('confirmed')
            expect(await statusOf(replacement)).toBe('failed')
            expect(receiptReads.filter(hash => hash === ORIGINAL)).toHaveLength(
                1,
            )
        })

        it('fails a replacement whose original an earlier pass confirmed', async () => {
            const { original, replacement } = await recordPair()
            await resolveSubmissionAttempt({
                db,
                id: original,
                status: 'confirmed',
            })
            minedAs(ORIGINAL)

            await reconcile()

            expect(await statusOf(replacement)).toBe('failed')
        })

        it('replaces an original whose replacement an earlier pass confirmed', async () => {
            const { original, replacement } = await recordPair()
            await resolveSubmissionAttempt({
                db,
                id: replacement,
                status: 'confirmed',
            })
            minedAs(REPLACEMENT)

            await reconcile()

            expect(await statusOf(original)).toBe('replaced')
        })

        it('keeps a re-priced original open past the grace window until its nonce is mined, then marks it replaced', async () => {
            const { original, replacement } = await recordPair()
            pastGraceWindow()
            // Not mined yet; the node has evicted the original for its replacement.
            node({
                latest: 0,
                eth_getTransactionByHash: params =>
                    params[0] === REPLACEMENT ? HELD_BY_NODE : null,
            })

            await reconcile()

            expect(await statusOf(original)).toBe('submitted')
            expect(await statusOf(replacement)).toBe('submitted')

            minedAs(REPLACEMENT)
            await reconcile()

            expect(await statusOf(original)).toBe('replaced')
            expect(await statusOf(replacement)).toBe('confirmed')
        })

        it('fails a re-priced original once its replacement is dropped too, so the nonce frees up', async () => {
            const { original, replacement } = await recordPair()
            pastGraceWindow()
            // Neither is mined, and the node holds neither.
            node({ latest: 0, eth_getTransactionByHash: null })

            await reconcile()
            await reconcile()

            expect(await statusOf(original)).toBe('failed')
            expect(await statusOf(replacement)).toBe('failed')
            await expect(
                allocateEthereumNonce({
                    client: getClient(SCOPE),
                    scope: SCOPE,
                    sender: SENDER,
                    db,
                }),
            ).resolves.toBe(0)
        })

        it('fails a replacement whose original was mined reverted and already settled failed', async () => {
            const { original, replacement } = await recordPair()
            await resolveSubmissionAttempt({
                db,
                id: original,
                status: 'failed',
            })
            node({
                latest: 1,
                eth_getTransactionReceipt: params =>
                    params[0] === ORIGINAL
                        ? evmTransactionReceipt({
                              transactionHash: ORIGINAL,
                              status: '0x0',
                          })
                        : null,
            })

            await reconcile()

            expect(await statusOf(replacement)).toBe('failed')
        })

        it('replaces an attempt whose nonce another wallet took', async () => {
            const original = await record({ txIds: [ORIGINAL] })
            minedAs(HASH)

            await reconcile()

            expect(await statusOf(original)).toBe('replaced')
        })
    })

    describe('a probe that keeps failing', () => {
        const N = PROBE_FAILURE_ESCALATION_STREAK
        const reporter = vi.fn()
        const internalError = () =>
            node({
                eth_getTransactionReceipt: new EvmRpcErrorFixture(
                    -32603,
                    'internal error',
                ),
            })
        const errorReports = () =>
            reporter.mock.calls
                .map(
                    call =>
                        call[0] as { severity: string; groupingKey?: string },
                )
                .filter(report => report.severity === 'error')
        const passes = async (count: number, ledgerDb = db) => {
            for (let pass = 0; pass < count; pass++) await reconcile(ledgerDb)
        }

        beforeEach(() => {
            reporter.mockClear()
            logger.setErrorReporter(reporter)
            vi.spyOn(console, 'warn').mockImplementation(() => {})
            vi.spyOn(console, 'error').mockImplementation(() => {})
        })

        afterEach(() => {
            logger.setErrorReporter(undefined)
            vi.restoreAllMocks()
        })

        it('reports once, at error severity, on the Nth consecutive failure', async () => {
            await record()
            internalError()

            await passes(N - 1)
            expect(errorReports()).toEqual([])

            await passes(1)
            expect(errorReports()).toHaveLength(1)
            // An unclassified node failure declares no code, so its own
            // site's stack does the grouping.
            expect(errorReports()[0]?.groupingKey).toBeUndefined()

            await passes(1)
            expect(errorReports()).toHaveLength(1)
        })

        it('escalates a non-viem failure under the escalation site, not evm.unknown', async () => {
            await record()
            node({ latest: 1 })

            // The ledger write is the reachable non-viem failure: a closed or
            // corrupted DB throws a plain Error into this catch, where
            // toEvmError would have mislabeled it `evm.unknown`.
            const failingLedger = new Proxy(db, {
                get(target, prop, receiver) {
                    if (prop === 'update') {
                        throw new Error('ledger write failed')
                    }
                    return Reflect.get(target, prop, receiver)
                },
            })

            await passes(N, failingLedger)

            expect(errorReports()).toEqual([
                expect.objectContaining({
                    severity: 'error',
                    groupingKey: 'ethereum reconcile: probe kept failing',
                }),
            ])
        })

        it('starts the streak over after a clean pass', async () => {
            await record()
            internalError()
            await passes(N - 1)
            node()
            await passes(1)
            internalError()

            await passes(N - 1)

            expect(errorReports()).toEqual([])
        })

        it('drops the streak of a row that settles', async () => {
            await record()
            internalError()
            await passes(2)
            expect(probeFailures.size).toBe(1)
            node({
                eth_getTransactionReceipt: evmTransactionReceipt({
                    transactionHash: HASH,
                }),
            })

            await reconcile()

            expect(probeFailures.size).toBe(0)
        })

        it('drops the streak of a row that left the open set', async () => {
            await record()
            internalError()
            await passes(2)
            const [id] = [...probeFailures.keys()]
            await resolveSubmissionAttempt({
                db,
                id: id as string,
                status: 'failed',
            })

            await reconcile()

            expect(probeFailures.size).toBe(0)
        })

        it.each([429, 500])(
            'does not report an RPC %i however long it lasts',
            async status => {
                await record()
                server.use(
                    http.post(
                        TEST_RPC_URL,
                        () => new HttpResponse(null, { status }),
                    ),
                )

                await passes(N)

                expect(probeFailures.size).toBe(1)
                expect([...probeFailures.values()]).toEqual([N])
                expect(errorReports()).toEqual([])
            },
        )
    })
})
