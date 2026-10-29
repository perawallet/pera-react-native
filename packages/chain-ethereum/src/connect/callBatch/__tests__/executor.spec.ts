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
import {
    bytesToHex,
    encodeFunctionData,
    erc20Abi,
    keccak256,
    type Hex,
} from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    findTransactionBatch,
    recordSubmissionAttempt,
    recordTransactionBatch,
    resolveSubmissionAttempt,
    retireReviewApproval,
    REVIEW_APPROVAL_TTL_MS,
    updateTransactionBatch,
    type TransactionBatch,
} from '@perawallet/wallet-core-signing'
import {
    initializeDatabase,
    resetDatabase,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { testChainContext } from '../../../__tests__/context'
import { ETHEREUM } from '../../../__tests__/evm-chains'
import {
    resumeEthereumCallBatches,
    runEthereumCallBatch,
    startEthereumCallBatch,
    type CallBatchExecutorDeps,
} from '../executor'
import { prepareEthereumCallBatch } from '../prepare'
import { callsStatusCodeOf } from '../status'
import {
    APPROVE,
    ROUTER,
    SENDER,
    SWAP,
    TOKEN,
    fakeNode,
    server,
    signAsSender,
} from './harness'

vi.mock('@perawallet/wallet-core-signing', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-signing')>()
    return {
        ...actual,
        retireReviewApproval: vi.fn(actual.retireReviewApproval),
    }
})

const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const APPROVAL = { token: 'approval-1' }
const ctx = testChainContext()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const deps: CallBatchExecutorDeps = {
    signTransaction: signAsSender,
    whenUnlocked: async () => {},
    confirmationTimeoutMs: 300,
}

const PAYLOAD = {
    calls: [APPROVE, SWAP].map(({ to, value, data }) => ({
        to,
        value: value.toString(),
        data,
    })),
    // Far above anything the fixture node prices.
    maxFeePerGasCeiling: (10n ** 18n).toString(),
}

const readBatch = async (batchId = 'batch-1'): Promise<TransactionBatch> => {
    const batch = await findTransactionBatch({
        chainId: 'ethereum',
        batchId,
        senders: [SENDER],
    })
    if (!batch) throw new Error(`no batch ${batchId}`)
    return batch
}

const settled = async (batchId = 'batch-1'): Promise<TransactionBatch> => {
    let batch = await readBatch(batchId)
    for (let i = 0; i < 100 && batch.outcome === 'running'; i++) {
        await new Promise(resolve => setTimeout(resolve, 20))
        batch = await readBatch(batchId)
    }
    return batch
}

/** Approves the batch as the review would: call 1 signed, the rest left to the executor. */
const approve = async (
    calls = [APPROVE, SWAP],
    overrides = deps,
    approval = APPROVAL,
) => {
    const prepared = await prepareEthereumCallBatch(ctx, ETHEREUM, {
        batchId: 'batch-1',
        from: SENDER,
        calls,
    })
    const first = await signAsSender(prepared.first)
    await startEthereumCallBatch(
        ctx,
        ETHEREUM,
        prepared,
        first,
        approval,
        overrides,
    )
    return first
}

describe('call batch execution', () => {
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        teardown = result.teardown
        await initializeDatabase({
            getDatabase: async () => result.db,
        } as unknown as Parameters<typeof initializeDatabase>[0])
    })

    afterEach(() => {
        resetDatabase()
        teardown()
    })

    it('Given an approve-then-swap batch, when it runs, then the swap is sent only after the approval has a receipt', async () => {
        const node = fakeNode()

        const first = await approve()
        const batch = await settled()

        expect(batch).toMatchObject({ outcome: 'confirmed', position: 1 })
        expect(batch.txIds).toHaveLength(2)
        expect(batch.txIds[0]).toBe(first.id)
        const [approval, swap] = batch.txIds
        expect(node.events.indexOf(`send:${swap}`)).toBeGreaterThan(
            node.events.indexOf(`receipt:${approval}:0x1`),
        )
        expect(callsStatusCodeOf(batch)).toBe(200)
    })

    it('Given the swap is reached, when it is signed in the background, then it names the approved review and the swap position on it', async () => {
        fakeNode()
        const approvals: unknown[] = []

        await approve(undefined, {
            ...deps,
            signTransaction: async (tx, approval) => {
                approvals.push(approval)
                return signAsSender(tx)
            },
        })
        await settled()

        expect(approvals).toEqual([{ token: 'approval-1', positions: [1] }])
    })

    it('Given the swap reverts, when the batch runs, then it stops reverted at the swap', async () => {
        fakeNode({
            statusFor: to =>
                to.toLowerCase() === ROUTER.toLowerCase() ? '0x0' : '0x1',
        })

        await approve()
        const batch = await settled()

        expect(batch).toMatchObject({ outcome: 'reverted', position: 1 })
        expect(callsStatusCodeOf(batch)).toBe(600)
    })

    it('Given the approval reverts, when the batch runs, then the swap is never sent', async () => {
        const node = fakeNode({
            statusFor: to =>
                to.toLowerCase() === TOKEN.toLowerCase() ? '0x0' : '0x1',
        })

        await approve()
        const batch = await settled()

        expect(batch).toMatchObject({ outcome: 'reverted', position: 0 })
        expect(node.sentCount()).toBe(1)
        expect(callsStatusCodeOf(batch)).toBe(500)
    })

    it('Given the swap cannot be estimated once reached, when the batch runs, then it fails there and sends nothing more', async () => {
        const node = fakeNode({ unestimable: ROUTER })

        await approve()
        const batch = await settled()

        expect(batch).toMatchObject({ outcome: 'failed', position: 1 })
        expect(node.sentCount()).toBe(1)
        expect(callsStatusCodeOf(batch)).toBe(600)
    })

    it('Given the network fee spikes past twice what the review priced, when the swap is reached, then the batch fails there and the swap is never signed', async () => {
        const node = fakeNode({ baseFeeAfterFirstSend: '0x2540be400' })
        let signings = 0

        await approve(undefined, {
            ...deps,
            signTransaction: async (tx, approval) => {
                signings += 1
                return deps.signTransaction!(tx, approval)
            },
        })
        const batch = await settled()

        expect(batch).toMatchObject({ outcome: 'failed', position: 1 })
        expect(signings).toBe(0)
        expect(node.sentCount()).toBe(1)
        expect(callsStatusCodeOf(batch)).toBe(600)
    })

    it('Given an approved review, when its batch settles, then the approval is retired, and not before', async () => {
        fakeNode()
        vi.mocked(retireReviewApproval).mockClear()
        const token = 'approval-of-this-batch'

        await approve(undefined, deps, { token })
        const batch = await settled()

        expect(batch.outcome).toBe('confirmed')
        expect(retireReviewApproval).toHaveBeenCalledTimes(1)
        expect(retireReviewApproval).toHaveBeenCalledWith({ token })
    })

    it('Given a locked app, when the swap is reached, then it waits for the unlock', async () => {
        const node = fakeNode()
        let unlock = () => {}
        const unlocked = new Promise<void>(resolve => {
            unlock = resolve
        })
        let reachUnlock = () => {}
        const reachedUnlock = new Promise<void>(resolve => {
            reachUnlock = resolve
        })

        await approve(undefined, {
            ...deps,
            whenUnlocked: () => {
                reachUnlock()
                return unlocked
            },
        })
        await reachedUnlock

        expect(node.sentCount()).toBe(1)
        expect((await readBatch()).outcome).toBe('running')

        unlock()
        expect(await settled()).toMatchObject({ outcome: 'confirmed' })
        expect(node.sentCount()).toBe(2)
    })

    it('Given the swap fails before it reaches the node, when the batch runs, then it fails rather than rebuilding it forever', async () => {
        const node = fakeNode()
        const unreadable: CallBatchExecutorDeps = {
            ...deps,
            signTransaction: async unsigned => ({
                ...(await signAsSender(unsigned)),
                bytes: new Uint8Array([1, 2, 3]),
            }),
        }

        await approve(undefined, unreadable)
        const batch = await settled()

        expect(batch).toMatchObject({ outcome: 'failed', position: 1 })
        expect(node.sentCount()).toBe(1)
    })

    it('Given a call that is never mined, when its wait runs out, then the batch is left running for the next tick', async () => {
        fakeNode({ isMining: false })
        const prepared = await prepareEthereumCallBatch(ctx, ETHEREUM, {
            batchId: 'batch-1',
            from: SENDER,
            calls: [APPROVE, SWAP],
        })
        const first = await signAsSender(prepared.first)
        const recorded = await recordTransactionBatch({
            scope: MAINNET,
            sender: SENDER,
            batchId: 'batch-1',
            approvalToken: APPROVAL.token,
            payload: PAYLOAD,
            txIds: [first.id],
            signedRaw: bytesToHex(first.bytes),
        })

        await runEthereumCallBatch(ctx, ETHEREUM, recorded, deps)

        expect(await readBatch()).toMatchObject({
            outcome: 'running',
            position: 0,
        })
    })

    describe('resume', () => {
        const recordAt = (txIds: string[], position = 0, signedRaw?: string) =>
            recordTransactionBatch({
                scope: MAINNET,
                sender: SENDER,
                batchId: 'batch-1',
                approvalToken: APPROVAL.token,
                payload: PAYLOAD,
                txIds,
                ...(signedRaw && { signedRaw }),
            }).then(async batch => {
                if (position === 0) return batch
                await updateTransactionBatch({
                    id: batch.id,
                    txIds,
                    signedRaw: signedRaw ?? null,
                    position,
                    outcome: 'running',
                })
                return { ...batch, position }
            })

        it('Given a batch that reached the swap with the approval landed, when it resumes, then only the swap is sent', async () => {
            const node = fakeNode()
            const approval = `0x${'aa'.repeat(32)}`
            await recordAt([approval], 1)

            await resumeEthereumCallBatches(ctx, ETHEREUM, deps)

            const batch = await readBatch()
            expect(batch).toMatchObject({ outcome: 'confirmed', position: 1 })
            expect(batch.txIds[0]).toBe(approval)
            expect(node.sentCount()).toBe(1)
            expect(node.events[0]).toBe(`send:${batch.txIds[1]}`)
        })

        it('Given the approval was sent before the restart, when it resumes, then it is awaited, never re-sent', async () => {
            const node = fakeNode()
            const signed = await signAsSender(
                (
                    await prepareEthereumCallBatch(ctx, ETHEREUM, {
                        from: SENDER,
                        calls: [APPROVE],
                    })
                ).first,
            )
            // On the node and on the ledger, as a send that outlived the app.
            node.sent.set(signed.id as Hex, '0x')
            await recordSubmissionAttempt({
                scope: MAINNET,
                txIds: [signed.id],
                flow: 'batch',
                sender: SENDER,
            })
            await recordAt([signed.id])

            await resumeEthereumCallBatches(ctx, ETHEREUM, deps)

            const batch = await readBatch()
            expect(batch).toMatchObject({ outcome: 'confirmed', position: 1 })
            expect(batch.txIds[0]).toBe(signed.id)
            expect(node.sentCount()).toBe(1)
            expect(node.events[0]).not.toBe(`send:${signed.id}`)
        })

        it('Given a recorded approval that never left the device, when it resumes, then it is built and sent again', async () => {
            const node = fakeNode()
            const lost = keccak256('0x01')
            await recordAt([lost])

            await resumeEthereumCallBatches(ctx, ETHEREUM, deps)

            const batch = await readBatch()
            expect(batch).toMatchObject({ outcome: 'confirmed', position: 1 })
            expect(batch.txIds[0]).not.toBe(lost)
            expect(node.sentCount()).toBe(2)
        })

        it('Given the app died between recording the approval and sending it, when it resumes, then the same signed bytes go out and the batch carries on', async () => {
            const node = fakeNode()
            const signed = await signAsSender(
                (
                    await prepareEthereumCallBatch(ctx, ETHEREUM, {
                        from: SENDER,
                        calls: [APPROVE],
                    })
                ).first,
            )
            // On the ledger, never on the node: the crash beat the send.
            await recordSubmissionAttempt({
                scope: MAINNET,
                txIds: [signed.id],
                flow: 'batch',
                sender: SENDER,
            })
            await recordAt([signed.id], 0, bytesToHex(signed.bytes))

            await resumeEthereumCallBatches(ctx, ETHEREUM, deps)

            const batch = await readBatch()
            expect(batch).toMatchObject({
                outcome: 'confirmed',
                position: 1,
                signedRaw: null,
            })
            expect(batch.txIds[0]).toBe(signed.id)
            expect(node.events[0]).toBe(`send:${signed.id}`)
            expect(node.sentCount()).toBe(2)
        })

        it('Given a recorded approval with its bytes that the ledger never saw, when it resumes, then those bytes are sent rather than a new transaction', async () => {
            const node = fakeNode()
            const signed = await signAsSender(
                (
                    await prepareEthereumCallBatch(ctx, ETHEREUM, {
                        from: SENDER,
                        calls: [APPROVE],
                    })
                ).first,
            )
            await recordAt([signed.id], 0, bytesToHex(signed.bytes))

            await resumeEthereumCallBatches(ctx, ETHEREUM, deps)

            expect((await readBatch()).txIds[0]).toBe(signed.id)
            expect(node.events[0]).toBe(`send:${signed.id}`)
        })

        it('Given the reconciler wrote the approval off as dropped, when it resumes, then the batch fails rather than sending it again', async () => {
            const node = fakeNode()
            const signed = await signAsSender(
                (
                    await prepareEthereumCallBatch(ctx, ETHEREUM, {
                        from: SENDER,
                        calls: [APPROVE],
                    })
                ).first,
            )
            const attemptId = await recordSubmissionAttempt({
                scope: MAINNET,
                txIds: [signed.id],
                flow: 'batch',
                sender: SENDER,
            })
            await resolveSubmissionAttempt({ id: attemptId, status: 'failed' })
            await recordAt([signed.id], 0, bytesToHex(signed.bytes))

            await resumeEthereumCallBatches(ctx, ETHEREUM, deps)

            expect(await readBatch()).toMatchObject({
                outcome: 'failed',
                position: 0,
            })
            expect(node.sentCount()).toBe(0)
        })

        it('Given a resume handed a row read before an earlier run finished the batch, when it runs, then it sends nothing and leaves the row settled', async () => {
            const node = fakeNode()
            const stale = await recordAt([])
            await runEthereumCallBatch(ctx, ETHEREUM, stale, deps)
            const settledRow = await readBatch()
            expect(settledRow).toMatchObject({ outcome: 'confirmed' })
            const sends = node.sentCount()

            const result = await runEthereumCallBatch(
                ctx,
                ETHEREUM,
                stale,
                deps,
            )

            expect(result).toEqual(settledRow)
            expect(await readBatch()).toEqual(settledRow)
            expect(node.sentCount()).toBe(sends)
        })

        it('Given a resume handed a row behind the one in the database, when it runs, then it carries on from the database row', async () => {
            const node = fakeNode()
            const stale = await recordAt([])
            const approval = await signAsSender(
                (
                    await prepareEthereumCallBatch(ctx, ETHEREUM, {
                        from: SENDER,
                        calls: [APPROVE],
                    })
                ).first,
            )
            // An earlier run landed the approval and moved on after `stale` was read.
            node.sent.set(approval.id as Hex, '0x')
            await updateTransactionBatch({
                id: stale.id,
                txIds: [approval.id],
                signedRaw: null,
                position: 1,
                outcome: 'running',
            })

            await runEthereumCallBatch(ctx, ETHEREUM, stale, deps)

            const batch = await readBatch()
            expect(batch).toMatchObject({ outcome: 'confirmed', position: 1 })
            expect(batch.txIds[0]).toBe(approval.id)
            expect(node.sentCount()).toBe(1)
        })

        it('Given two ticks resume at once, when the batch runs, then each call is sent once', async () => {
            const node = fakeNode()
            await recordAt([])

            await Promise.all([
                resumeEthereumCallBatches(ctx, ETHEREUM, deps),
                resumeEthereumCallBatches(ctx, ETHEREUM, deps),
            ])
            await settled()

            expect(node.sentCount()).toBe(2)
        })

        it('Given the wallet has since moved to another network, when the batch resumes, then it still runs on its own', async () => {
            const node = fakeNode()
            await recordAt([])
            const onSepolia = {
                ...ctx,
                getScope: () => ({ chainId: 'ethereum', networkId: 'sepolia' }),
            }

            const batch = await runEthereumCallBatch(
                onSepolia,
                ETHEREUM,
                await readBatch(),
                deps,
            )

            expect(batch).toMatchObject({ outcome: 'confirmed' })
            expect(node.sentCount()).toBe(2)
        })

        it('Given a batch approved more than a day ago with a token transfer still to run, when it resumes, then it fails there and the transfer is never signed', async () => {
            const node = fakeNode()
            const signTransaction = vi.fn(signAsSender)
            const transfer = {
                to: TOKEN,
                value: '0',
                data: encodeFunctionData({
                    abi: erc20Abi,
                    functionName: 'transfer',
                    args: [ROUTER, 1_000_000n],
                }),
            }
            const approvedAt = Date.now() - REVIEW_APPROVAL_TTL_MS - 1
            vi.spyOn(Date, 'now').mockReturnValueOnce(approvedAt)
            const recorded = await recordTransactionBatch({
                scope: MAINNET,
                sender: SENDER,
                batchId: 'batch-1',
                approvalToken: APPROVAL.token,
                payload: { ...PAYLOAD, calls: [PAYLOAD.calls[0], transfer] },
                txIds: [`0x${'aa'.repeat(32)}`],
            })
            await updateTransactionBatch({
                id: recorded.id,
                txIds: recorded.txIds,
                signedRaw: null,
                position: 1,
                outcome: 'running',
            })

            await resumeEthereumCallBatches(ctx, ETHEREUM, {
                ...deps,
                signTransaction,
            })

            expect(await readBatch()).toMatchObject({
                outcome: 'failed',
                position: 1,
            })
            expect(signTransaction).not.toHaveBeenCalled()
            expect(node.sentCount()).toBe(0)
        })
    })
})
