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
import { delay, http, HttpResponse } from 'msw'
import { Decimal } from 'decimal.js'
import { setupServer } from 'msw/node'
import {
    getAddress,
    hexToBytes,
    keccak256,
    parseTransaction,
    type Hex,
    type RpcTransaction,
    type TransactionSerializableEIP1559,
} from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { logger } from '@perawallet/wallet-core-shared'
import {
    getOpenSubmissionAttempts,
    SubmissionError,
    getUnsyncedSubmissionSpends,
    getSubmissionAttemptsWithHistoryEntry,
    recordSubmissionAttempt,
    SubmissionAttemptsSchema,
    TransportError,
    type SigningResult,
    type SourceMetadata,
    type SubmissionHistoryEntry,
} from '@perawallet/wallet-core-signing'
import {
    initializeDatabase,
    resetDatabase,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { EvmErrorCode, evmErrorCodeOf } from '../../blockchain/errors'
import { createEvmClient } from '../../blockchain/utils/createEvmClient'
import {
    EvmRpcErrorFixture,
    evmRpcHandlers,
    evmTransactionReceipt,
    type EvmRpcFixtures,
} from '../../blockchain/msw-handlers'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'
import {
    SENDER,
    VIEM_ERC20_TRANSFER,
    VIEM_TRANSFER_NONCE_0,
    VIEM_TRANSFER_NONCE_0_SPED_UP,
    VIEM_TRANSFER_NONCE_0_UNDERPRICED,
} from '../../signing/__tests__/fixtures'
import { ethereumCallSummary } from '../../signing/review'
import { createEvmBroadcasterAdapter } from '../broadcaster'
import {
    SubmissionLedgerUnreadableError,
    submitEthereumTransactions,
} from '../submission'
import { BASE, ETHEREUM, evmScopeOf } from '../../__tests__/evm-chains'
import { opStackOracleResponder, unsignedEncodingOf } from './op-stack-oracle'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const BYTES = hexToBytes(VIEM_TRANSFER_NONCE_0)
const HASH = keccak256(VIEM_TRANSFER_NONCE_0)
const SOURCE = { type: 'local' } as SourceMetadata
const NOT_MINED = { blockNumber: null } as unknown as RpcTransaction

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const useRpc = (responses: EvmRpcFixtures['responses'] = {}) =>
    server.use(...evmRpcHandlers({ rpcUrl: TEST_RPC_URL, responses }))

const adapter = createEvmBroadcasterAdapter(testChainContext(), ETHEREUM, {
    confirmationTimeoutMs: 200,
})
const client = () => createEvmClient(SCOPE, testChainContext(), ETHEREUM)

const signed = (data: SigningResult['signedData']): SigningResult => ({
    signedData: data,
    signers: [],
})
const HISTORY_ENTRY: SubmissionHistoryEntry = {
    summary: {
        kind: 'transfer',
        title: { key: 'transactions.list_item.send' },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'evm' },
}
const signedTransactions = signed({
    type: 'signed-transactions',
    signed: [{ scope: SCOPE, id: HASH, bytes: BYTES }],
    historyEntries: [HISTORY_ENTRY],
})

describe('Ethereum broadcaster adapter', () => {
    let db: Database
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        await initializeDatabase({
            getDatabase: async () => db,
        } as unknown as Parameters<typeof initializeDatabase>[0])
    })

    afterEach(() => {
        resetDatabase()
        teardown()
    })

    const rows = () => db.select().from(SubmissionAttemptsSchema).all()
    const reporter = vi.fn()
    const reports = () =>
        reporter.mock.calls.map(
            call => call[0] as { severity: string; groupingKey?: string },
        )

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

    describe('submitAndAutoRefresh', () => {
        const SIGNED = [{ scope: SCOPE, id: HASH, bytes: BYTES }]

        it('records the attempt with the call’s history entry and resolves with the hash', async () => {
            useRpc()
            const parsed = parseTransaction(VIEM_TRANSFER_NONCE_0)

            const txIds = await adapter.submitAndAutoRefresh(SCOPE, SIGNED)

            expect(txIds).toEqual([HASH])
            const [attempt] = await getSubmissionAttemptsWithHistoryEntry({
                db,
                scope: SCOPE,
            })
            expect(attempt!.historyEntry).toEqual({
                summary: ethereumCallSummary(
                    {
                        from: SENDER,
                        to: getAddress(parsed.to!),
                        value: parsed.value ?? 0n,
                        data: parsed.data ?? '0x',
                    },
                    ETHEREUM,
                ),
                chainData: { family: 'evm' },
                fee: new Decimal('420000000000000'),
            })
            expect(await getOpenSubmissionAttempts({ db })).toMatchObject([
                {
                    txIds: [HASH],
                    flow: 'pipeline',
                    sender: SENDER,
                    chainData: { family: 'evm' },
                },
            ])
        })

        it('makes no eth_call on a chain without an OP-stack fee oracle', async () => {
            const calls: unknown[] = []
            useRpc({
                eth_call: params => {
                    calls.push(params)
                    return '0x'
                },
            })

            await adapter.submitAndAutoRefresh(SCOPE, SIGNED)

            expect(calls).toEqual([])
        })

        it('marks a node refusal failed and rethrows it', async () => {
            useRpc({
                eth_sendRawTransaction: new EvmRpcErrorFixture(
                    -32000,
                    'nonce too low',
                ),
            })

            await expect(
                adapter.submitAndAutoRefresh(SCOPE, SIGNED),
            ).rejects.toMatchObject({ classification: 'rejected-by-node' })
            expect(await rows()).toMatchObject([{ status: 'failed' }])
        })

        it('refuses a send whose nonce another open send holds, without recording or sending it', async () => {
            useRpc()
            await recordSubmissionAttempt({
                db,
                scope: SCOPE,
                txIds: ['0xother'],
                flow: 'pipeline',
                sender: SENDER,
                nonce: 0,
            })

            await expect(
                adapter.submitAndAutoRefresh(SCOPE, SIGNED),
            ).rejects.toMatchObject({
                classification: 'rejected-by-node',
                nodeError: { code: EvmErrorCode.NONCE_TOO_LOW },
            })
            expect(await rows()).toHaveLength(1)
        })

        it('still resends a transaction whose own open row holds the nonce', async () => {
            useRpc()
            await recordSubmissionAttempt({
                db,
                scope: SCOPE,
                txIds: [HASH],
                flow: 'pipeline',
                sender: SENDER,
                nonce: 0,
            })

            await expect(
                adapter.submitAndAutoRefresh(SCOPE, SIGNED),
            ).resolves.toEqual([HASH])
        })

        it('submits to the scope it is given, not the selected network', async () => {
            useRpc()
            const onSepolia = createEvmBroadcasterAdapter(
                {
                    ...testChainContext(),
                    getScope: () => ({
                        chainId: 'ethereum',
                        networkId: 'sepolia',
                    }),
                },
                ETHEREUM,
            )

            const txIds = await onSepolia.submitAndAutoRefresh(SCOPE, SIGNED)

            expect(txIds).toEqual([HASH])
            expect(await rows()).toMatchObject([{ scope: 'ethereum/mainnet' }])
        })
    })

    describe('on Base', () => {
        const BASE_SCOPE = evmScopeOf(BASE)
        const base = createEvmBroadcasterAdapter(
            testChainContext({ chain: BASE }),
            BASE,
        )
        const SIGNED = [{ scope: BASE_SCOPE, id: HASH, bytes: BYTES }]
        const GAS_FEE = 420_000_000_000_000n
        const L1_FEE = 5_000_000_000n
        const OPERATOR_FEE = 7_000n

        const useOracle = (l1Fees: ReadonlyMap<Hex, bigint>) =>
            useRpc({
                eth_call: opStackOracleResponder({
                    l1Fees,
                    operatorFee: OPERATOR_FEE,
                }),
            })

        it('records an open send’s max fee as gas x max fee per gas plus twice the oracle’s fee for the signed bytes', async () => {
            useOracle(
                new Map([
                    [
                        unsignedEncodingOf(
                            parseTransaction(
                                VIEM_TRANSFER_NONCE_0,
                            ) as TransactionSerializableEIP1559,
                        ),
                        L1_FEE,
                    ],
                ]),
            )

            await base.submitAndAutoRefresh(BASE_SCOPE, SIGNED)

            const expected = new Decimal(
                (GAS_FEE + 2n * (L1_FEE + OPERATOR_FEE)).toString(),
            )
            const [attempt] = await getSubmissionAttemptsWithHistoryEntry({
                db,
                scope: BASE_SCOPE,
            })
            expect(await rows()).toMatchObject([{ maxFee: expected }])
            expect(attempt!.historyEntry?.fee).toEqual(expected)
        })

        it('records gas x max fee per gas alone, and still sends, when the oracle read fails', async () => {
            const sent: unknown[] = []
            useRpc({
                eth_call: opStackOracleResponder({
                    l1Fees: new Map(),
                    operatorFee: OPERATOR_FEE,
                }),
                eth_sendRawTransaction: params => {
                    sent.push(params[0])
                    return HASH
                },
            })

            const txIds = await base.submitAndAutoRefresh(BASE_SCOPE, SIGNED)

            expect(txIds).toEqual([HASH])
            expect(sent).toEqual([VIEM_TRANSFER_NONCE_0])
            expect(await rows()).toMatchObject([
                { maxFee: new Decimal(GAS_FEE.toString()) },
            ])
        })

        it('refuses a send whose oracle read was overtaken by a send recorded at the same nonce', async () => {
            const heldEncoding = unsignedEncodingOf(
                parseTransaction(
                    VIEM_ERC20_TRANSFER,
                ) as TransactionSerializableEIP1559,
            )
            let markHeld!: () => void
            const isHeld = new Promise<void>(resolve => {
                markHeld = resolve
            })
            let release!: () => void
            const released = new Promise<void>(resolve => {
                release = resolve
            })
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: TEST_RPC_URL,
                    responses: {
                        eth_call: opStackOracleResponder({
                            l1Fees: new Map(),
                            operatorFee: OPERATOR_FEE,
                        }),
                        eth_sendRawTransaction: params =>
                            keccak256(params[0] as Hex),
                    },
                }),
            )
            // Prepended, so it sees each request before the fixture answers it.
            server.use(
                http.post(TEST_RPC_URL, async ({ request }) => {
                    const body = await request.clone().text()
                    if (!body.includes(heldEncoding.slice(2))) return undefined
                    markHeld()
                    await released
                    return undefined
                }),
            )
            const sendOf = (hex: Hex) =>
                base.submitAndAutoRefresh(BASE_SCOPE, [
                    {
                        scope: BASE_SCOPE,
                        id: keccak256(hex),
                        bytes: hexToBytes(hex),
                    },
                ])

            const held = sendOf(VIEM_ERC20_TRANSFER).catch(
                (caught: unknown) => caught,
            )
            await isHeld
            await sendOf(VIEM_TRANSFER_NONCE_0)
            release()

            expect(await held).toMatchObject({
                classification: 'rejected-by-node',
                nodeError: { code: EvmErrorCode.NONCE_TOO_LOW },
            })
            expect(await rows()).toMatchObject([
                { rawTransaction: VIEM_TRANSFER_NONCE_0 },
            ])
        })
    })

    describe('submit transport', () => {
        it('records an open pipeline row with the nonce and sender, then returns the hash', async () => {
            useRpc()

            const result = await adapter
                .createSubmitTransport(SCOPE)
                .send(signedTransactions, SOURCE)

            expect(result).toEqual({ type: 'submitted', txIds: [HASH] })
            expect(await getOpenSubmissionAttempts({ db })).toMatchObject([
                {
                    txIds: [HASH],
                    flow: 'pipeline',
                    nonce: 0,
                    sender: SENDER,
                    status: 'submitted',
                    chainData: { family: 'evm' },
                },
            ])
        })

        it('answers the source with the submitted ids and reports submitted-and-answered', async () => {
            useRpc()
            const approve = vi.fn(async () => undefined)

            const result = await adapter
                .createSubmitTransport(SCOPE)
                .send(signedTransactions, {
                    type: 'walletconnect',
                    callbacks: { approve },
                })

            expect(approve).toHaveBeenCalledWith(signedTransactions, {
                txIds: [HASH],
            })
            expect(result).toEqual({
                type: 'submitted-and-answered',
                txIds: [HASH],
            })
        })

        it('still reports submitted when the source callback throws after the broadcast', async () => {
            useRpc()
            const approve = vi.fn(async () => {
                throw new Error('delivery failed')
            })

            const result = await adapter
                .createSubmitTransport(SCOPE)
                .send(signedTransactions, {
                    type: 'walletconnect',
                    callbacks: { approve },
                })

            expect(result).toEqual({ type: 'submitted', txIds: [HASH] })
            expect(await rows()).toMatchObject([{ status: 'submitted' }])
        })

        it('does not call the source callback when the node refuses', async () => {
            useRpc({
                eth_sendRawTransaction: new EvmRpcErrorFixture(
                    -32000,
                    'nonce too low',
                ),
            })
            const approve = vi.fn(async () => undefined)

            await expect(
                adapter.createSubmitTransport(SCOPE).send(signedTransactions, {
                    type: 'walletconnect',
                    callbacks: { approve },
                }),
            ).rejects.toMatchObject({ classification: 'rejected-by-node' })
            expect(approve).not.toHaveBeenCalled()
        })

        it('records the history entry with the most the transaction can be charged', async () => {
            useRpc()

            await adapter
                .createSubmitTransport(SCOPE)
                .send(signedTransactions, SOURCE)

            const [attempt] = await getSubmissionAttemptsWithHistoryEntry({
                db,
                scope: SCOPE,
            })
            expect(attempt!.historyEntry).toEqual({
                ...HISTORY_ENTRY,
                fee: new Decimal('420000000000000'),
            })
        })

        it('records no history entry for a transaction the result lists none for, but still its max fee', async () => {
            useRpc()

            await adapter.createSubmitTransport(SCOPE).send(
                signed({
                    type: 'signed-transactions',
                    signed: [{ scope: SCOPE, id: HASH, bytes: BYTES }],
                    historyEntries: [],
                }),
                SOURCE,
            )

            expect(
                await getSubmissionAttemptsWithHistoryEntry({
                    db,
                    scope: SCOPE,
                }),
            ).toEqual([])
            expect(
                await getUnsyncedSubmissionSpends({ db, scope: SCOPE }),
            ).toMatchObject([
                {
                    historyEntry: null,
                    maxFee: new Decimal('420000000000000'),
                },
            ])
        })

        it('resolves the row failed and rejects as rejected-by-node when the node refuses', async () => {
            useRpc({
                eth_sendRawTransaction: new EvmRpcErrorFixture(
                    -32000,
                    'insufficient funds for gas * price + value',
                ),
            })

            await expect(
                adapter
                    .createSubmitTransport(SCOPE)
                    .send(signedTransactions, SOURCE),
            ).rejects.toMatchObject({ classification: 'rejected-by-node' })
            expect(await rows()).toMatchObject([{ status: 'failed' }])
        })

        it('marks the row unknown and rejects as unknown-outcome when there is no answer', async () => {
            server.use(http.post(TEST_RPC_URL, () => HttpResponse.error()))

            await expect(
                adapter
                    .createSubmitTransport(SCOPE)
                    .send(signedTransactions, SOURCE),
            ).rejects.toMatchObject({ classification: 'unknown-outcome' })
            expect(await rows()).toMatchObject([{ status: 'unknown' }])
            expect(reports().map(report => report.severity)).not.toContain(
                'error',
            )
        })

        it('still sends when the ledger write fails', async () => {
            useRpc()
            vi.spyOn(db, 'insert').mockImplementation(() => {
                throw new Error('disk full')
            })

            await expect(
                adapter
                    .createSubmitTransport(SCOPE)
                    .send(signedTransactions, SOURCE),
            ).resolves.toEqual({ type: 'submitted', txIds: [HASH] })
        })

        it('refuses as retryable, without sending, when the ledger read fails', async () => {
            useRpc()
            const methods: string[] = []
            const listener = async ({ request }: { request: Request }) => {
                const body = (await request.clone().json()) as {
                    method: string
                }
                methods.push(body.method)
            }
            server.events.on('request:start', listener)
            resetDatabase()

            try {
                const sent = adapter
                    .createSubmitTransport(SCOPE)
                    .send(signedTransactions, SOURCE)

                await expect(sent).rejects.toBeInstanceOf(
                    SubmissionLedgerUnreadableError,
                )
                await expect(sent).rejects.not.toBeInstanceOf(SubmissionError)
                expect(methods).not.toContain('eth_sendRawTransaction')
                expect(reports()).toEqual([])
            } finally {
                server.events.removeListener('request:start', listener)
            }
        })

        it('refuses submitAndAutoRefresh as retryable, without sending, when the ledger read fails', async () => {
            const sends = vi.fn((): Hex => HASH)
            useRpc({ eth_sendRawTransaction: sends })
            resetDatabase()

            const refused = adapter.submitAndAutoRefresh(SCOPE, [
                { scope: SCOPE, id: HASH, bytes: BYTES },
            ])

            await expect(refused).rejects.toBeInstanceOf(
                SubmissionLedgerUnreadableError,
            )
            await expect(refused).rejects.toMatchObject({
                metadata: { retryable: true },
            })
            expect(sends).not.toHaveBeenCalled()
            expect(reports()).toEqual([])
        })

        it('throws TransportError and writes no row for anything but signed transactions', async () => {
            await expect(
                adapter.createSubmitTransport(SCOPE).send(
                    signed({
                        type: 'arbitrary-data',
                        signatures: [new Uint8Array([1])],
                    }),
                    SOURCE,
                ),
            ).rejects.toBeInstanceOf(TransportError)
            expect(await rows()).toHaveLength(0)
        })
    })

    describe('reporting a failed submit', () => {
        const SIGNED = [{ scope: SCOPE, id: HASH, bytes: BYTES }]
        const sendOnTransport = () =>
            adapter
                .createSubmitTransport(SCOPE)
                .send(signedTransactions, SOURCE)

        it.each([
            [
                'replacement transaction underpriced',
                'evm.replacement_underpriced',
            ],
            [
                'insufficient funds for gas * price + value',
                'evm.insufficient_funds',
            ],
        ])(
            'groups a node refusal of "%s" under %s as a breadcrumb',
            async (message, key) => {
                useRpc({
                    eth_sendRawTransaction: new EvmRpcErrorFixture(
                        -32000,
                        message,
                    ),
                })

                await expect(sendOnTransport()).rejects.toBeInstanceOf(
                    SubmissionError,
                )

                expect(reports()).toEqual([
                    expect.objectContaining({
                        severity: 'expected',
                        groupingKey: key,
                    }),
                ])
            },
        )

        it.each([429, 503])(
            'reports an RPC %i only as a breadcrumb',
            async status => {
                server.use(
                    http.post(
                        TEST_RPC_URL,
                        () => new HttpResponse(null, { status }),
                    ),
                )

                await expect(sendOnTransport()).rejects.toThrow()

                expect(reports().length).toBeGreaterThan(0)
                expect(reports().map(report => report.severity)).toEqual(
                    reports().map(() => 'expected'),
                )
            },
        )

        it('reports a refused submitAndAutoRefresh under its code', async () => {
            useRpc({
                eth_sendRawTransaction: new EvmRpcErrorFixture(
                    -32000,
                    'nonce too low',
                ),
            })

            await expect(
                adapter.submitAndAutoRefresh(SCOPE, SIGNED),
            ).rejects.toBeInstanceOf(SubmissionError)

            expect(reports()).toEqual([
                expect.objectContaining({
                    severity: 'error',
                    groupingKey: 'evm.nonce_too_low',
                }),
            ])
        })
    })

    describe('a replacement at a nonce an open send holds', () => {
        const sendBytes = (hex: `0x${string}`) =>
            adapter.createSubmitTransport(SCOPE).send(
                signed({
                    type: 'signed-transactions',
                    signed: [
                        {
                            scope: SCOPE,
                            id: keccak256(hex),
                            bytes: hexToBytes(hex),
                        },
                    ],
                    historyEntries: [HISTORY_ENTRY],
                }),
                SOURCE,
            )
        const sends = vi.fn()
        const useCountingRpc = (responses: EvmRpcFixtures['responses'] = {}) =>
            useRpc({
                eth_sendRawTransaction: params => {
                    sends(params[0])
                    return keccak256(params[0] as `0x${string}`)
                },
                ...responses,
            })

        beforeEach(() => {
            sends.mockClear()
        })

        it('records the bytes and links the attempt it replaces', async () => {
            useCountingRpc()
            await sendBytes(VIEM_TRANSFER_NONCE_0)

            await sendBytes(VIEM_TRANSFER_NONCE_0_SPED_UP)

            const [original, replacement] = await rows()
            expect(original).toMatchObject({
                rawTransaction: VIEM_TRANSFER_NONCE_0,
                replacesAttemptId: null,
            })
            expect(replacement).toMatchObject({
                txIdsJson: JSON.stringify([
                    keccak256(VIEM_TRANSFER_NONCE_0_SPED_UP),
                ]),
                nonce: 0,
                rawTransaction: VIEM_TRANSFER_NONCE_0_SPED_UP,
                replacesAttemptId: original!.id,
            })
        })

        it('links nothing on a resend of the same bytes', async () => {
            useCountingRpc()
            await sendBytes(VIEM_TRANSFER_NONCE_0)

            await sendBytes(VIEM_TRANSFER_NONCE_0)

            expect((await rows()).map(row => row.replacesAttemptId)).toEqual([
                null,
                null,
            ])
        })

        it('refuses a different call at a held nonce as a collision, without sending or recording it', async () => {
            useCountingRpc()
            await sendBytes(VIEM_TRANSFER_NONCE_0)
            sends.mockClear()

            await expect(sendBytes(VIEM_ERC20_TRANSFER)).rejects.toMatchObject({
                classification: 'rejected-by-node',
                nodeError: { code: EvmErrorCode.NONCE_TOO_LOW },
            })
            expect(sends).not.toHaveBeenCalled()
            expect(await rows()).toHaveLength(1)
        })

        it('refuses a replacement under the 10% bump without sending or recording it', async () => {
            useCountingRpc()
            await sendBytes(VIEM_TRANSFER_NONCE_0)
            sends.mockClear()

            const error = await sendBytes(
                VIEM_TRANSFER_NONCE_0_UNDERPRICED,
            ).catch((caught: unknown) => caught)

            expect(error).toBeInstanceOf(SubmissionError)
            expect(error).toMatchObject({ classification: 'rejected-by-node' })
            expect(evmErrorCodeOf((error as SubmissionError).nodeError)).toBe(
                EvmErrorCode.REPLACEMENT_UNDERPRICED,
            )
            expect(sends).not.toHaveBeenCalled()
            expect(await rows()).toHaveLength(1)
            expect(reports()).toEqual([
                expect.objectContaining({
                    severity: 'expected',
                    groupingKey: 'evm.replacement_underpriced',
                }),
            ])
        })

        it('says the transaction already confirmed when the node finds the nonce used', async () => {
            useCountingRpc()
            await sendBytes(VIEM_TRANSFER_NONCE_0)
            useCountingRpc({
                eth_sendRawTransaction: new EvmRpcErrorFixture(
                    -32000,
                    'nonce too low',
                ),
                eth_getTransactionByHash: null,
            })

            const error = await sendBytes(VIEM_TRANSFER_NONCE_0_SPED_UP).catch(
                (caught: unknown) => caught,
            )

            expect(error).toBeInstanceOf(SubmissionError)
            expect(evmErrorCodeOf((error as SubmissionError).nodeError)).toBe(
                EvmErrorCode.REPLACED_TRANSACTION_CONFIRMED,
            )
            expect((await rows()).map(row => row.status)).toEqual([
                'submitted',
                'failed',
            ])
            expect(reports().map(report => report.severity)).not.toContain(
                'error',
            )
        })
    })

    describe('with a second RPC URL', () => {
        const FIRST_RPC = 'https://first.rpc.test/'

        it('reads a resend its second node already holds as accepted, after the first timed out', async () => {
            const context = {
                ...testChainContext(),
                getEndpoints: () => ({ mainnet: [FIRST_RPC, TEST_RPC_URL] }),
                timeouts: { readMs: 1_000, submitMs: 800 },
            }
            server.use(
                http.post(FIRST_RPC, async () => {
                    await delay(1_500)
                }),
                ...evmRpcHandlers({
                    rpcUrl: TEST_RPC_URL,
                    responses: {
                        eth_sendRawTransaction: new EvmRpcErrorFixture(
                            -32003,
                            'already known',
                        ),
                    },
                }),
            )

            await expect(
                createEvmBroadcasterAdapter(context, ETHEREUM).submit(SCOPE, [
                    BYTES,
                ]),
            ).resolves.toEqual([HASH])
        })

        it("does not read the second node's refusal as not on chain after the first timed out", async () => {
            const context = {
                ...testChainContext(),
                getEndpoints: () => ({ mainnet: [FIRST_RPC, TEST_RPC_URL] }),
                timeouts: { readMs: 1_000, submitMs: 800 },
            }
            server.use(
                http.post(FIRST_RPC, async () => {
                    await delay(1_500)
                }),
                ...evmRpcHandlers({
                    rpcUrl: TEST_RPC_URL,
                    responses: {
                        eth_sendRawTransaction: new EvmRpcErrorFixture(
                            -32000,
                            'transaction underpriced',
                        ),
                    },
                }),
            )

            await expect(
                createEvmBroadcasterAdapter(context, ETHEREUM).submit(SCOPE, [
                    BYTES,
                ]),
            ).rejects.toMatchObject({ classification: 'unknown-outcome' })
        })

        it('moves on from a node whose backend is down and reads a later "already known" as accepted', async () => {
            const context = {
                ...testChainContext(),
                getEndpoints: () => ({ mainnet: [FIRST_RPC, TEST_RPC_URL] }),
            }
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: FIRST_RPC,
                    responses: {
                        eth_sendRawTransaction: new EvmRpcErrorFixture(
                            -32603,
                            'internal error',
                        ),
                    },
                }),
                ...evmRpcHandlers({
                    rpcUrl: TEST_RPC_URL,
                    responses: {
                        eth_sendRawTransaction: new EvmRpcErrorFixture(
                            -32003,
                            'already known',
                        ),
                    },
                }),
            )

            await expect(
                createEvmBroadcasterAdapter(context, ETHEREUM).submit(SCOPE, [
                    BYTES,
                ]),
            ).resolves.toEqual([HASH])
        })

        it("reads a later node's refusal as an unknown outcome after the first answered internal error", async () => {
            const context = {
                ...testChainContext(),
                getEndpoints: () => ({ mainnet: [FIRST_RPC, TEST_RPC_URL] }),
            }
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: FIRST_RPC,
                    responses: {
                        eth_sendRawTransaction: new EvmRpcErrorFixture(
                            -32603,
                            'internal error',
                        ),
                    },
                }),
                ...evmRpcHandlers({
                    rpcUrl: TEST_RPC_URL,
                    responses: {
                        eth_sendRawTransaction: new EvmRpcErrorFixture(
                            -32000,
                            'transaction underpriced',
                        ),
                    },
                }),
            )

            await expect(
                createEvmBroadcasterAdapter(context, ETHEREUM).submit(SCOPE, [
                    BYTES,
                ]),
            ).rejects.toMatchObject({ classification: 'unknown-outcome' })
        })

        it('reads an internal error from the only node as an unknown outcome', async () => {
            useRpc({
                eth_sendRawTransaction: new EvmRpcErrorFixture(
                    -32603,
                    'internal error',
                ),
                eth_getTransactionByHash: null,
            })

            await expect(
                submitEthereumTransactions(client(), [BYTES], ETHEREUM),
            ).rejects.toMatchObject({ classification: 'unknown-outcome' })
        })

        it("keeps the first node's refusal as rejected-by-node and never asks the second", async () => {
            const context = {
                ...testChainContext(),
                getEndpoints: () => ({ mainnet: [FIRST_RPC, TEST_RPC_URL] }),
            }
            const secondCalls = vi.fn()
            server.use(
                http.post(TEST_RPC_URL, () => {
                    secondCalls()
                    return undefined
                }),
                ...evmRpcHandlers({
                    rpcUrl: FIRST_RPC,
                    responses: {
                        eth_sendRawTransaction: new EvmRpcErrorFixture(
                            -32000,
                            'transaction underpriced',
                        ),
                    },
                }),
                ...evmRpcHandlers({ rpcUrl: TEST_RPC_URL }),
            )

            await expect(
                createEvmBroadcasterAdapter(context, ETHEREUM).submit(SCOPE, [
                    BYTES,
                ]),
            ).rejects.toMatchObject({ classification: 'rejected-by-node' })
            expect(secondCalls).not.toHaveBeenCalled()
        })
    })

    describe('submitEthereumTransactions', () => {
        const nonceTooLow = new EvmRpcErrorFixture(-32000, 'nonce too low')

        it('accepts a resend that reads nonce too low while the node holds the hash', async () => {
            useRpc({
                eth_sendRawTransaction: nonceTooLow,
                eth_getTransactionByHash: NOT_MINED,
            })

            await expect(
                submitEthereumTransactions(client(), [BYTES], ETHEREUM),
            ).resolves.toEqual([HASH])
        })

        it.each([
            'already known',
            'Known transaction: 0xabc',
            'AlreadyKnown',
            'transaction already imported',
        ])(
            'accepts a resend of pooled bytes the node refuses as %s',
            async message => {
                useRpc({
                    eth_sendRawTransaction: new EvmRpcErrorFixture(
                        -32003,
                        message,
                    ),
                })

                await expect(
                    submitEthereumTransactions(client(), [BYTES], ETHEREUM),
                ).resolves.toEqual([HASH])
            },
        )

        it('does not read an unknown-transaction-type refusal as already known', async () => {
            useRpc({
                eth_sendRawTransaction: new EvmRpcErrorFixture(
                    -32000,
                    'unknown transaction type',
                ),
            })

            await expect(
                submitEthereumTransactions(client(), [BYTES], ETHEREUM),
            ).rejects.toMatchObject({ classification: 'rejected-by-node' })
        })

        it('rejects nonce too low as rejected-by-node when the node does not know the hash', async () => {
            useRpc({
                eth_sendRawTransaction: nonceTooLow,
                eth_getTransactionByHash: null,
            })

            await expect(
                submitEthereumTransactions(client(), [BYTES], ETHEREUM),
            ).rejects.toMatchObject({
                classification: 'rejected-by-node',
                nodeError: { code: EvmErrorCode.NONCE_TOO_LOW },
            })
        })

        it('rejects nonce too low as unknown-outcome when the hash lookup fails', async () => {
            useRpc({
                eth_sendRawTransaction: nonceTooLow,
                eth_getTransactionByHash: new EvmRpcErrorFixture(
                    -32000,
                    'boom',
                ),
            })

            await expect(
                submitEthereumTransactions(client(), [BYTES], ETHEREUM),
            ).rejects.toMatchObject({ classification: 'unknown-outcome' })
        })
    })

    describe('whether any node answered a failed broadcast', () => {
        const failWith = (respond: () => Response) =>
            server.use(http.post(TEST_RPC_URL, respond))

        it('is unanswered when the connection drops', async () => {
            failWith(() => HttpResponse.error())

            await expect(
                submitEthereumTransactions(client(), [BYTES], ETHEREUM),
            ).rejects.toMatchObject({
                classification: 'unknown-outcome',
                isUnanswered: true,
                nodeError: { code: EvmErrorCode.NETWORK_UNREACHABLE },
            })
        })

        it('is unanswered when the gateway fails without a verdict', async () => {
            failWith(() => new HttpResponse(null, { status: 503 }))

            await expect(
                submitEthereumTransactions(client(), [BYTES], ETHEREUM),
            ).rejects.toMatchObject({ isUnanswered: true })
        })

        it.each([
            [
                'a gateway answering 500 with a verdict in the body',
                () => new HttpResponse('insufficient funds', { status: 500 }),
                EvmErrorCode.INSUFFICIENT_FUNDS,
            ],
            [
                'a rate limit',
                () => new HttpResponse(null, { status: 429 }),
                EvmErrorCode.RATE_LIMITED,
            ],
        ])('is answered for %s', async (_name, respond, code) => {
            failWith(respond)

            await expect(
                submitEthereumTransactions(client(), [BYTES], ETHEREUM),
            ).rejects.toMatchObject({
                isUnanswered: false,
                nodeError: { code },
            })
        })

        it('is answered when the node refused the transaction', async () => {
            useRpc({
                eth_sendRawTransaction: new EvmRpcErrorFixture(
                    -32000,
                    'insufficient funds',
                ),
            })

            await expect(
                submitEthereumTransactions(client(), [BYTES], ETHEREUM),
            ).rejects.toMatchObject({
                classification: 'rejected-by-node',
                isUnanswered: false,
            })
        })
    })

    describe('members', () => {
        it('rejects the wait on a reverted receipt', async () => {
            useRpc({
                eth_getTransactionReceipt: evmTransactionReceipt({
                    transactionHash: HASH,
                    status: '0x0',
                }),
            })

            await expect(
                adapter.waitForConfirmation(SCOPE, [HASH]),
            ).rejects.toMatchObject({ code: EvmErrorCode.REVERTED })
        })

        it('derives keccak ids from the signed bytes', () => {
            expect(adapter.deriveSubmissionAttemptFromBytes([BYTES])).toEqual({
                txIds: [HASH],
                chainData: { family: 'evm' },
            })
        })

        it('times out as a retryable unknown outcome', () => {
            expect(adapter.submitTimeoutError(5_000)).toMatchObject({
                classification: 'unknown-outcome',
                metadata: { retryable: true },
                nodeError: { code: EvmErrorCode.TIMEOUT },
                isUnanswered: true,
            })
        })

        it('has nothing to check for an unsigned request', async () => {
            const request = {} as Parameters<
                typeof adapter.isRequestGroupAlreadySubmitted
            >[0]

            await expect(
                adapter.isRequestGroupAlreadySubmitted(request),
            ).resolves.toBe(false)
            await expect(adapter.findStaleGroupReason(request)).resolves.toBe(
                null,
            )
        })
    })
})
