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
import { recordTransactionBatch } from '@perawallet/wallet-core-signing'
import {
    initializeDatabase,
    resetDatabase,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { testChainContext } from '../../../__tests__/context'
import { ETHEREUM } from '../../../__tests__/evm-chains'
import {
    createEvmPlannerAdapter,
    readEvmTransaction,
} from '../../../signing/adapter'
import { createEthereumReviewer, ethereumViewOf } from '../../../signing/review'
import { prepareEthereumCallBatch, previewEthereumCall } from '../prepare'
import {
    APPROVE,
    ROUTER,
    SENDER,
    SWAP,
    TOKEN,
    fakeNode,
    server,
} from './harness'

const ctx = testChainContext()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('prepareEthereumCallBatch', () => {
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        teardown = result.teardown
        await initializeDatabase({
            getDatabase: async () => result.db,
        } as unknown as Parameters<typeof initializeDatabase>[0])
        fakeNode()
    })

    afterEach(() => {
        resetDatabase()
        teardown()
    })

    it('Given an approve-then-swap batch, when prepared, then the approval is priced and the swap is a preview', async () => {
        const prepared = await prepareEthereumCallBatch(ctx, ETHEREUM, {
            batchId: 'batch-1',
            from: SENDER,
            calls: [APPROVE, SWAP],
        })

        expect(prepared.batchId).toBe('batch-1')
        expect(ethereumViewOf(prepared.first, ETHEREUM)).toMatchObject({
            to: APPROVE.to,
            gas: 0xfde8n,
            nonce: 0,
        })
        expect(prepared.following).toHaveLength(1)
        expect(ethereumViewOf(prepared.following[0], ETHEREUM)).toEqual(
            expect.objectContaining({
                kind: 'contract-call',
                to: SWAP.to,
                isPreview: true,
            }),
        )
        expect(prepared.following[0].summary.kind).toBe('contract-call')
        const { maxFeePerGas } = readEvmTransaction(
            prepared.first,
            ETHEREUM,
        ).transaction
        expect(prepared.following[0].payload).toMatchObject({
            maxFeePerGasCeiling: maxFeePerGas! * 2n,
        })
        expect(prepared.request).toMatchObject({
            maxFeePerGasCeiling: maxFeePerGas! * 2n,
        })
    })

    it('Given a preview, when the planner is asked to sign it, then it refuses', async () => {
        const { following } = await prepareEthereumCallBatch(ctx, ETHEREUM, {
            from: SENDER,
            calls: [APPROVE, SWAP],
        })

        expect(() =>
            createEvmPlannerAdapter(ETHEREUM).plan(following[0]),
        ).toThrow('never signed')
    })

    it('Given no id from the dApp, when prepared, then the wallet picks one', async () => {
        const prepared = await prepareEthereumCallBatch(ctx, ETHEREUM, {
            from: SENDER,
            calls: [APPROVE],
        })

        expect(prepared.batchId).toEqual(expect.any(String))
        expect(prepared.batchId.length).toBeGreaterThan(0)
        expect(prepared.request).toMatchObject({ batchId: prepared.batchId })
    })

    it('Given the sender already used the id on another EVM chain, when prepared, then it is refused with 5720 too', async () => {
        await recordTransactionBatch({
            scope: { chainId: 'polygon', networkId: 'mainnet' },
            sender: SENDER,
            batchId: 'batch-1',
            approvalToken: 'approval-1',
            payload: { calls: [] },
            txIds: [],
        })

        await expect(
            prepareEthereumCallBatch(ctx, ETHEREUM, {
                batchId: 'batch-1',
                from: SENDER,
                calls: [APPROVE, SWAP],
            }),
        ).rejects.toMatchObject({ wireCode: 5720 })
    })

    it('Given the sender already used the id, when prepared, then it is refused with 5720 before anything is built', async () => {
        await recordTransactionBatch({
            scope: ctx.getScope(),
            sender: SENDER,
            batchId: 'batch-1',
            approvalToken: 'approval-1',
            payload: { calls: [] },
            txIds: [],
        })

        await expect(
            prepareEthereumCallBatch(ctx, ETHEREUM, {
                batchId: 'batch-1',
                from: SENDER,
                calls: [APPROVE, SWAP],
            }),
        ).rejects.toMatchObject({ wireCode: 5720 })
    })
})

describe('matching a built call to the preview the user approved', () => {
    const { matchesApprovedPreview } = createEthereumReviewer({
        chain: ETHEREUM,
    }).policy
    const match = (
        ...args: Parameters<NonNullable<typeof matchesApprovedPreview>>
    ) => matchesApprovedPreview?.(...args)

    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        teardown = result.teardown
        await initializeDatabase({
            getDatabase: async () => result.db,
        } as unknown as Parameters<typeof initializeDatabase>[0])
        fakeNode()
    })

    afterEach(() => {
        resetDatabase()
        teardown()
    })

    const built = async (call = SWAP) =>
        (
            await prepareEthereumCallBatch(ctx, ETHEREUM, {
                from: SENDER,
                calls: [call],
            })
        ).first

    // Far above anything the fixture node prices, unless a test lowers it.
    const previewOf = (call = SWAP, ceiling = 10n ** 18n) =>
        previewEthereumCall(ctx.getScope(), ETHEREUM, call, ceiling)

    it('Given the swap built once reached, when matched to its preview, then it matches though it gained nonce, gas and fees', async () => {
        expect(match(await built(), previewOf())).toBe(true)
    })

    it.each([
        ['other calldata', { ...SWAP, data: '0xdeadbeef' as const }],
        ['another target', { ...SWAP, to: TOKEN }],
        ['another value', { ...SWAP, value: 1n }],
    ])(
        'Given a preview with %s, when matched, then it does not match',
        async (_, shown) => {
            expect(match(await built(), previewOf(shown))).toBe(false)
        },
    )

    it('Given the first call as the review showed it priced, when its rebuild is matched, then it matches', async () => {
        expect(match(await built(), await built())).toBe(true)
    })

    it('Given a preview standing in for the built call, when matched, then it does not match', () => {
        expect(match(previewOf(), previewOf())).toBe(false)
    })

    it('Given a preview from another account, when matched, then it does not match', async () => {
        const other = previewOf({ ...SWAP, from: ROUTER })

        expect(match(await built(), other)).toBe(false)
    })

    it('Given a call priced above the ceiling its preview carried, when matched, then it does not match', async () => {
        const call = await built()
        const { maxFeePerGas } = readEvmTransaction(call, ETHEREUM).transaction

        expect(match(call, previewOf(SWAP, maxFeePerGas! - 1n))).toBe(false)
        expect(match(call, previewOf(SWAP, maxFeePerGas!))).toBe(true)
    })

    it('Given the first call rebuilt at more than twice the fee the review priced, when matched, then it does not match', async () => {
        const call = await built()
        const { transaction } = readEvmTransaction(call, ETHEREUM)
        const cheaper = {
            ...call,
            payload: {
                ...(call.payload as object),
                transaction: {
                    ...transaction,
                    maxFeePerGas: transaction.maxFeePerGas! / 2n - 1n,
                },
            },
        }

        expect(match(call, cheaper)).toBe(false)
    })
})
