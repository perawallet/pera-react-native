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
import {
    recordSubmissionAttempt,
    SubmissionAttemptsSchema,
} from '@perawallet/wallet-core-signing'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import {
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
    reconcileEthereumSubmissions,
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

    const reconcile = () =>
        reconcileEthereumSubmissions({
            chain: ETHEREUM,
            settleHandlers,
            getClient,
            db,
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
})
