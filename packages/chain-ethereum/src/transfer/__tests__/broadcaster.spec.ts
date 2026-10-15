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
} from 'vitest'
import { http, HttpResponse } from 'msw'
import { Decimal } from 'decimal.js'
import { setupServer } from 'msw/node'
import { hexToBytes, keccak256, type RpcTransaction } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    getOpenSubmissionAttempts,
    getUnsyncedSubmissionSpends,
    getSubmissionAttemptsWithHistoryEntry,
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
import { EvmErrorCode } from '../../blockchain/errors'
import { createEvmClient } from '../../blockchain/utils/createEvmClient'
import {
    EvmRpcErrorFixture,
    evmRpcHandlers,
    evmTransactionReceipt,
    type EvmRpcFixtures,
} from '../../blockchain/msw-handlers'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'
import { SENDER, VIEM_TRANSFER_NONCE_0 } from '../../signing/__tests__/fixtures'
import { createEthereumBroadcasterAdapter } from '../broadcaster'
import { submitEthereumTransactions } from '../submission'

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

const adapter = createEthereumBroadcasterAdapter(testChainContext(), {
    confirmationTimeoutMs: 200,
})
const client = () => createEvmClient(SCOPE, testChainContext())

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
                },
            ])
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
        })

        it('still sends when the ledger write fails', async () => {
            useRpc()
            resetDatabase()

            await expect(
                adapter
                    .createSubmitTransport(SCOPE)
                    .send(signedTransactions, SOURCE),
            ).resolves.toEqual({ type: 'submitted', txIds: [HASH] })
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

    describe('submitEthereumTransactions', () => {
        const nonceTooLow = new EvmRpcErrorFixture(-32000, 'nonce too low')

        it('accepts a resend that reads nonce too low while the node holds the hash', async () => {
            useRpc({
                eth_sendRawTransaction: nonceTooLow,
                eth_getTransactionByHash: NOT_MINED,
            })

            await expect(
                submitEthereumTransactions(client(), [BYTES]),
            ).resolves.toEqual([HASH])
        })

        it('does not read an unknown-transaction-type refusal as already known', async () => {
            useRpc({
                eth_sendRawTransaction: new EvmRpcErrorFixture(
                    -32000,
                    'unknown transaction type',
                ),
            })

            await expect(
                submitEthereumTransactions(client(), [BYTES]),
            ).rejects.toMatchObject({ classification: 'rejected-by-node' })
        })

        it('rejects nonce too low as rejected-by-node when the node does not know the hash', async () => {
            useRpc({
                eth_sendRawTransaction: nonceTooLow,
                eth_getTransactionByHash: null,
            })

            await expect(
                submitEthereumTransactions(client(), [BYTES]),
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
                submitEthereumTransactions(client(), [BYTES]),
            ).rejects.toMatchObject({ classification: 'unknown-outcome' })
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
            })
        })

        it('times out as a retryable unknown outcome', () => {
            expect(adapter.submitTimeoutError(5_000)).toMatchObject({
                classification: 'unknown-outcome',
                metadata: { retryable: true },
            })
        })

        it('refuses submitAndAutoRefresh, which takes the Algorand envelope', async () => {
            await expect(
                adapter.submitAndAutoRefresh(SCOPE, []),
            ).rejects.toThrow(/createSubmitTransport/)
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
