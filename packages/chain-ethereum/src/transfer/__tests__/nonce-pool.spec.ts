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
import { setupServer } from 'msw/node'
import { hexToBytes, toHex } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    recordSubmissionAttempt,
    resolveSubmissionAttempt,
} from '@perawallet/wallet-core-signing'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { evmRpcHandlers } from '../../blockchain/msw-handlers'
import { createEvmClient } from '../../blockchain/utils/createEvmClient'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'
import {
    SENDER,
    VIEM_TRANSFER_NONCE_0,
    VIEM_TRANSFER_NONCE_0_SPED_UP,
} from '../../signing/__tests__/fixtures'
import { allocateEthereumNonce } from '../nonce-pool'
import { submitAndRecordEthereumTransactions } from '../submission'
import { ETHEREUM } from '../../__tests__/evm-chains'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const OTHER_SENDER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const client = createEvmClient(SCOPE, testChainContext(), ETHEREUM)

const nodeReportsPending = (count: number) =>
    server.use(
        ...evmRpcHandlers({
            rpcUrl: TEST_RPC_URL,
            responses: { eth_getTransactionCount: toHex(count) },
        }),
    )

describe('allocateEthereumNonce', () => {
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

    const allocate = () =>
        allocateEthereumNonce({ client, scope: SCOPE, sender: SENDER, db })

    const record = (
        nonce: number,
        overrides: Partial<Parameters<typeof recordSubmissionAttempt>[0]> = {},
    ) =>
        recordSubmissionAttempt({
            db,
            scope: SCOPE,
            txIds: [`0x${nonce.toString(16)}`],
            flow: 'pipeline',
            sender: SENDER,
            nonce,
            ...overrides,
        })

    it('holds one nonce for a send and its replacement, so the next send takes the one after', async () => {
        nodeReportsPending(0)
        await submitAndRecordEthereumTransactions({
            client,
            chain: ETHEREUM,
            scope: SCOPE,
            signedTransactions: [
                hexToBytes(VIEM_TRANSFER_NONCE_0),
                hexToBytes(VIEM_TRANSFER_NONCE_0_SPED_UP),
            ],
            flow: 'pipeline',
            historyEntries: [],
            db,
        })

        await expect(allocate()).resolves.toBe(1)
    })

    it('gives a second send the next nonce while the node still reports the first as unseen', async () => {
        nodeReportsPending(0)
        await submitAndRecordEthereumTransactions({
            client,
            chain: ETHEREUM,
            scope: SCOPE,
            signedTransactions: [hexToBytes(VIEM_TRANSFER_NONCE_0)],
            flow: 'pipeline',
            historyEntries: [],
            db,
        })

        await expect(allocate()).resolves.toBe(1)
    })

    it('does not count a send twice once the node reports it pending', async () => {
        nodeReportsPending(1)
        await record(0)

        await expect(allocate()).resolves.toBe(1)
    })

    it('runs past every open nonce', async () => {
        nodeReportsPending(0)
        await record(0)
        await record(1)

        await expect(allocate()).resolves.toBe(2)
    })

    it('fills the gap a failed row left below an open one', async () => {
        nodeReportsPending(0)
        const dropped = await record(0)
        await record(1)
        await resolveSubmissionAttempt({ db, id: dropped, status: 'failed' })

        await expect(allocate()).resolves.toBe(0)
    })

    it('fails closed when the ledger cannot be read', async () => {
        nodeReportsPending(0)

        await expect(
            allocateEthereumNonce({
                client,
                scope: SCOPE,
                sender: SENDER,
                db: {} as Database,
            }),
        ).rejects.toThrow()
    })

    it('ignores other senders, other scopes and terminal rows', async () => {
        nodeReportsPending(0)
        await record(0, { sender: OTHER_SENDER })
        await record(0, {
            scope: { chainId: 'ethereum', networkId: 'sepolia' },
        })
        const confirmed = await record(0)
        await resolveSubmissionAttempt({
            db,
            id: confirmed,
            status: 'confirmed',
        })
        const replaced = await record(0)
        await resolveSubmissionAttempt({ db, id: replaced, status: 'replaced' })

        await expect(allocate()).resolves.toBe(0)
    })
})
