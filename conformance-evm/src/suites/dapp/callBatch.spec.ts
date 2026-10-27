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

import { bytesToHex, type Address, type Hex } from 'viem'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReviewApprovalRef } from '@perawallet/wallet-core-signing'
import {
    findTransactionBatch,
    getSubmissionAttemptsByTxIds,
} from '@perawallet/wallet-core-signing'
import {
    getReviewApproval,
    recordReviewApproval,
} from '@perawallet/wallet-core-signing/db/repository'
import type { TransactionBatch } from '@perawallet/wallet-core-signing/db/types'
import { logger } from '@perawallet/wallet-core-shared'
import type {
    ChainContext,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import {
    resumeEthereumCallBatches,
    startEthereumCallBatch,
    type CallBatchExecutorDeps,
} from '@perawallet/wallet-core-chain-ethereum/connect/callBatch/executor'
import {
    MAX_CALLS_PER_BATCH,
    validateEthereumSendCalls,
    type EthereumCallBatchRequest,
} from '@perawallet/wallet-core-chain-ethereum/connect/callBatch/params'
import {
    prepareEthereumCallBatch,
    type PreparedEthereumCallBatch,
} from '@perawallet/wallet-core-chain-ethereum/connect/callBatch/prepare'
import { readEthereumCallsStatus } from '@perawallet/wallet-core-chain-ethereum/connect/callBatch/status'
import type { EthereumTransactionPayload } from '@perawallet/wallet-core-chain-ethereum/signing/adapter'
import {
    EvmError,
    EvmErrorCode,
} from '@perawallet/wallet-core-chain-ethereum/blockchain/errors'

import {
    createRawKeyEvmAccount,
    fundEvmAccount,
    type EvmConformanceAccount,
} from '../../harness/accounts'
import { expectEvmConformant } from '../../harness/assert/roundTrip'
import {
    ANVIL_DEV_PRIVATE_KEY,
    castCall,
    castCalldata,
    castSend,
} from '../../harness/cast'
import { deployContract } from '../../harness/contracts'
import {
    createEvmConformanceEnv,
    type EvmConformanceEnv,
} from '../../harness/context'
import { anvilRpc, EVMNET, txpoolCounts } from '../../harness/evmnet'
import { withSeverableRpc } from '../../harness/rpcProxy'
import { signedTransactionWithApp } from '../../harness/sign'
import {
    feesOf,
    REVERTING_CALL_GAS,
    transactionOf,
} from '../submission/support'

const SPENDER: Address = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
const RECIPIENT: Address = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const SECOND_RECIPIENT: Address = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'

// Every amount is above 2^53, so a `number` anywhere on the path would round it.
const UNIT = 9_007_199_254_740_993n
const HELD = UNIT * 1_000_000n
const ALLOWANCE = UNIT * 777n
const FIRST_AMOUNT = UNIT * 1001n
const SECOND_AMOUNT = UNIT * 2003n

const SETTLE_DEADLINE_MS = 30_000
// Anvil mines on receipt of a send; a receipt this late means the app sent
// nothing, and the batch is left running for the settle deadline to report.
const RECEIPT_WAIT_MS = 5000

afterEach(() => {
    vi.restoreAllMocks()
})

type Batch = {
    env: EvmConformanceEnv
    owner: EvmConformanceAccount
    token: Address
}

const setUp = async (): Promise<Batch> => {
    const env = await createEvmConformanceEnv('ethereum')
    const owner = await createRawKeyEvmAccount(env)
    await fundEvmAccount(env, owner.address, 10n ** 18n)
    const token = await deployContract(
        env.chain,
        'TestToken',
        ['Conformance Token', 'CFT', (10n ** 30n).toString()],
        'constructor(string,string,uint256)',
    )
    await castSend({
        chain: env.chain,
        privateKey: ANVIL_DEV_PRIVATE_KEY,
        to: token,
        sig: 'transfer(address,uint256)',
        args: [owner.address, HELD.toString()],
    })
    return { env, owner, token }
}

const calldataOf = {
    approve: () =>
        castCalldata('approve(address,uint256)', [
            SPENDER,
            ALLOWANCE.toString(),
        ]),
    transfer: (to: Address, amount: bigint) =>
        castCalldata('transfer(address,uint256)', [to, amount.toString()]),
    revertWithReason: () => castCalldata('revertWithReason()'),
}

type Call = { to: Address; data: Hex }

/** The dApp's `wallet_sendCalls` params, through the validation WalletConnect runs. */
const validatedBatch = (
    owner: Address,
    calls: readonly Call[],
): EthereumCallBatchRequest => {
    const result = validateEthereumSendCalls(
        [
            {
                version: '2.0.0',
                chainId: `0x${EVMNET.ethereum.eip155ChainId.toString(16)}`,
                from: owner,
                atomicRequired: false,
                calls,
            },
        ],
        {
            authorizedAccounts: [owner],
            eip155ChainId: EVMNET.ethereum.eip155ChainId,
        },
    )
    if (!result.ok) throw new Error(result.message)
    return result.request
}

const settledBatch = async (
    env: EvmConformanceEnv,
    batchId: string,
    sender: Address,
): Promise<TransactionBatch> => {
    const deadline = Date.now() + SETTLE_DEADLINE_MS
    for (;;) {
        const batch = await findTransactionBatch({
            chainId: env.scope.chainId,
            batchId,
            senders: [sender],
        })
        if (batch && batch.outcome !== 'running') return batch
        if (Date.now() > deadline) {
            throw new Error(
                `batch ${batchId} still ${batch?.outcome ?? 'unrecorded'} after ${SETTLE_DEADLINE_MS} ms`,
            )
        }
        await new Promise(resolve => setTimeout(resolve, 100))
    }
}

type Started = {
    prepared: Awaited<ReturnType<typeof prepareEthereumCallBatch>>
    approvalToken: string
    /** Every signed call in order: the review signs the first, the executor the rest. */
    raws: Hex[]
    /** The review position each background signature named. */
    positions: number[][]
    /** The executor deps the batch runs with, for a resume to reuse. */
    deps: CallBatchExecutorDeps
}

type StartOptions = {
    /** Deps beyond the signer, which may read the prepared batch's ceiling. */
    depsFor?: (prepared: PreparedEthereumCallBatch) => CallBatchExecutorDeps
    /** Runs after the executor's signer returns, before the executor records or sends. */
    onSigned?: (position: number) => void
    ctx?: ChainContext
}

/**
 * The approval as the review pipeline performs it: the first call signed by
 * the app's signing pipeline and the reviewed calls recorded as an approval.
 * The executor's background signer is the same app pipeline.
 */
const startBatch = async (
    { env, owner }: Batch,
    request: EthereumCallBatchRequest,
    { depsFor, onSigned, ctx = env.ctx }: StartOptions = {},
): Promise<Started> => {
    const prepared = await prepareEthereumCallBatch(ctx, env.evmChain, request)
    const first = await signedTransactionWithApp(env, owner, prepared.first)
    const approvalToken = await recordReviewApproval({
        scope: env.scope,
        transactions: [prepared.first, ...prepared.following],
    })
    const raws: Hex[] = [bytesToHex(first.bytes)]
    const positions: number[][] = []
    const signTransaction = async (
        tx: UnsignedTransaction,
        approval: ReviewApprovalRef,
    ) => {
        expect(approval.token).toBe(approvalToken)
        positions.push(approval.positions)
        const signed = await signedTransactionWithApp(env, owner, tx)
        raws.push(bytesToHex(signed.bytes))
        onSigned?.(approval.positions[0])
        return signed
    }
    const deps: CallBatchExecutorDeps = {
        signTransaction,
        whenUnlocked: async () => {},
        confirmationTimeoutMs: RECEIPT_WAIT_MS,
        ...depsFor?.(prepared.request as PreparedEthereumCallBatch),
    }
    await startEthereumCallBatch(
        ctx,
        env.evmChain,
        prepared,
        first,
        { token: approvalToken },
        deps,
    )
    return { prepared, approvalToken, raws, positions, deps }
}

type NodeTransaction = { nonce: Hex; input: Hex; from: string; to: string }

const nodeTransactionOf = async (
    env: EvmConformanceEnv,
    hash: string,
): Promise<NodeTransaction> => {
    const tx = await anvilRpc<NodeTransaction | null>(
        env.chain,
        'eth_getTransactionByHash',
        [hash],
    )
    if (!tx) throw new Error(`the node has no transaction ${hash}`)
    return tx
}

const pendingNonceOf = async (
    env: EvmConformanceEnv,
    address: Address,
): Promise<number> =>
    Number(
        BigInt(
            await anvilRpc<Hex>(env.chain, 'eth_getTransactionCount', [
                address,
                'pending',
            ]),
        ),
    )

const tokenRead = async (
    env: EvmConformanceEnv,
    token: Address,
    sig: string,
    args: string[],
): Promise<bigint> =>
    BigInt(
        (await castCall({ chain: env.chain, to: token, sig, args })).split(
            ' ',
        )[0],
    )

const balanceOf = (env: EvmConformanceEnv, token: Address, holder: Address) =>
    tokenRead(env, token, 'balanceOf(address)(uint256)', [holder])

const allowanceOf = (env: EvmConformanceEnv, token: Address, owner: Address) =>
    tokenRead(env, token, 'allowance(address,address)(uint256)', [
        owner,
        SPENDER,
    ])

/** The node holds exactly `count` of the sender's transactions and pools none. */
const expectNothingSentPast = async (
    env: EvmConformanceEnv,
    sender: Address,
    count: number,
) => {
    expect(await pendingNonceOf(env, sender)).toBe(count)
    expect(await txpoolCounts(env.chain)).toEqual({ pending: 0, queued: 0 })
}

const nextBaseFeeOf = async (env: EvmConformanceEnv): Promise<bigint> => {
    const history = await anvilRpc<{ baseFeePerGas: Hex[] }>(
        env.chain,
        'eth_feeHistory',
        ['0x1', 'latest', []],
    )
    return BigInt(history.baseFeePerGas.at(-1)!)
}

const setNextBaseFee = (env: EvmConformanceEnv, wei: bigint) =>
    anvilRpc(env.chain, 'anvil_setNextBlockBaseFeePerGas', [
        `0x${wei.toString(16)}`,
    ])

const warningsAbout = (
    warn: { mock: { calls: unknown[][] } },
    message: string,
) =>
    warn.mock.calls
        .filter(([logged]) => logged === message)
        .map(([, context]) => context as { position?: number; error: unknown })

/**
 * Proves a dApp's `wallet_sendCalls` batch runs on a real node the way the
 * review promised: each call built, signed by the app's own signing pipeline
 * and sent only once the one before it has a receipt, in nonce order, with the
 * calldata the dApp asked for; a call that would revert, or whose fee rose
 * past the reviewed ceiling, stops the batch with nothing after it sent; and a
 * restart rebroadcasts the bytes it already signed rather than a second
 * transaction. A mock node can't tell an estimate refusal from an on-chain
 * revert, or say whether a later call was ever pooled.
 */
describe('evm dapp wallet_sendCalls against a node', () => {
    it(`refuses more than ${MAX_CALLS_PER_BATCH} calls and accepts exactly ${MAX_CALLS_PER_BATCH}`, () => {
        const owner = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
        const calls = (count: number) =>
            Array.from({ length: count }, () => ({ to: RECIPIENT, data: '0x' }))
        const validate = (count: number) =>
            validateEthereumSendCalls(
                {
                    version: '2.0.0',
                    chainId: `0x${EVMNET.ethereum.eip155ChainId.toString(16)}`,
                    from: owner,
                    atomicRequired: false,
                    calls: calls(count),
                },
                {
                    authorizedAccounts: [owner],
                    eip155ChainId: EVMNET.ethereum.eip155ChainId,
                },
            )

        expect(validate(MAX_CALLS_PER_BATCH + 1)).toEqual({
            ok: false,
            failure: 'invalid-params',
            message: `A batch holds between 1 and ${MAX_CALLS_PER_BATCH} calls`,
        })
        expect(validate(MAX_CALLS_PER_BATCH)).toMatchObject({ ok: true })
    })

    it('runs approve, transfer, transfer in order and lands their exact effects', async () => {
        const setup = await setUp()
        const { env, owner, token } = setup
        const calls = [
            { to: token, data: await calldataOf.approve() },
            {
                to: token,
                data: await calldataOf.transfer(RECIPIENT, FIRST_AMOUNT),
            },
            {
                to: token,
                data: await calldataOf.transfer(
                    SECOND_RECIPIENT,
                    SECOND_AMOUNT,
                ),
            },
        ]

        const { prepared, approvalToken, raws, positions } = await startBatch(
            setup,
            validatedBatch(owner.address, calls),
        )
        const batch = await settledBatch(env, prepared.batchId, owner.address)

        const { maxFeePerGasCeiling } =
            prepared.request as PreparedEthereumCallBatch
        const firstMaxFee = (
            prepared.first.payload as EthereumTransactionPayload
        ).transaction.maxFeePerGas!
        expect(maxFeePerGasCeiling).toBe(firstMaxFee * 2n)
        expect(batch).toMatchObject({
            outcome: 'confirmed',
            position: calls.length - 1,
        })
        expect(batch.txIds).toHaveLength(calls.length)
        expect(positions).toEqual([[1], [2]])

        const status = await readEthereumCallsStatus(
            env.ctx,
            env.evmChain,
            batch,
        )
        expect(status).toMatchObject({
            version: '2.0.0',
            id: prepared.batchId,
            chainId: `0x${EVMNET.ethereum.eip155ChainId.toString(16)}`,
            atomic: false,
            status: 200,
        })
        expect(status.receipts.map(receipt => receipt.transactionHash)).toEqual(
            batch.txIds,
        )
        expect(status.receipts.map(receipt => receipt.status)).toEqual([
            '0x1',
            '0x1',
            '0x1',
        ])
        const blocks = status.receipts.map(receipt =>
            BigInt(receipt.blockNumber),
        )
        expect(blocks[1]).toBeGreaterThan(blocks[0])
        expect(blocks[2]).toBeGreaterThan(blocks[1])

        for (const [index, call] of calls.entries()) {
            const raw = raws[index]
            // Only gas and pricing are the wallet's; the price stays under
            // the reviewed ceiling.
            const fees = feesOf(raw)
            expect(fees.maxFeePerGas).toBeLessThanOrEqual(maxFeePerGasCeiling)
            expect(fees.maxFeePerGas).toBeGreaterThanOrEqual(
                fees.maxPriorityFeePerGas,
            )
            const gas = transactionOf(raw).gas!
            expect(gas).toBeGreaterThan(21_000n)
            // Round-trip: the dApp's call at the next nonce, from the wallet's account.
            await expectEvmConformant({
                env,
                intent: {
                    chainId: EVMNET.ethereum.eip155ChainId,
                    from: owner.address,
                    nonce: index,
                    to: call.to,
                    data: call.data,
                    gas,
                    ...fees,
                },
                raw,
                hash: batch.txIds[index] as Hex,
            })
        }

        expect(await allowanceOf(env, token, owner.address)).toBe(ALLOWANCE)
        expect(await balanceOf(env, token, RECIPIENT)).toBe(FIRST_AMOUNT)
        expect(await balanceOf(env, token, SECOND_RECIPIENT)).toBe(
            SECOND_AMOUNT,
        )
        expect(await balanceOf(env, token, owner.address)).toBe(
            HELD - FIRST_AMOUNT - SECOND_AMOUNT,
        )
        // A settled batch's review vouches for nothing more.
        expect(await getReviewApproval({ token: approvalToken })).toBeNull()
    })

    describe('a reverting second call', () => {
        const revertingBatch = async (setup: Batch) => {
            const reverter = await deployContract(setup.env.chain, 'Reverter')
            return [
                { to: setup.token, data: await calldataOf.approve() },
                { to: reverter, data: await calldataOf.revertWithReason() },
                {
                    to: setup.token,
                    data: await calldataOf.transfer(RECIPIENT, FIRST_AMOUNT),
                },
            ]
        }

        it("is refused by the node's estimate before signing: the batch fails there and the third call is never sent", async () => {
            const setup = await setUp()
            const { env, owner, token } = setup
            const warn = vi.spyOn(logger, 'warn')

            // A dApp's calls carry no gas, so every later call is estimated.
            const { prepared, raws, positions } = await startBatch(
                setup,
                validatedBatch(owner.address, await revertingBatch(setup)),
            )
            const batch = await settledBatch(
                env,
                prepared.batchId,
                owner.address,
            )

            expect(batch).toMatchObject({ outcome: 'failed', position: 1 })
            expect(batch.txIds).toEqual([batch.txIds[0]])
            expect(raws).toHaveLength(1)
            expect(positions).toEqual([])
            // Node acceptance: the estimate's refusal carries the contract's reason.
            const [refusal] = warningsAbout(
                warn,
                '[ethereum] a batched call could not be signed',
            )
            expect(refusal.position).toBe(1)
            expect(refusal.error).toBeInstanceOf(EvmError)
            expect((refusal.error as EvmError).code).toBe(
                EvmErrorCode.REVERTED_WITH_REASON,
            )
            expect((refusal.error as Error).message).toContain(
                'Execution reverted with reason: conformance: reason.',
            )

            const status = await readEthereumCallsStatus(
                env.ctx,
                env.evmChain,
                batch,
            )
            // Partly executed: the approve landed before the stop.
            expect(status.status).toBe(600)
            expect(
                status.receipts.map(receipt => receipt.transactionHash),
            ).toEqual(batch.txIds)
            expect(status.receipts[0].status).toBe('0x1')
            await expectNothingSentPast(env, owner.address, 1)
            expect(await allowanceOf(env, token, owner.address)).toBe(ALLOWANCE)
            expect(await balanceOf(env, token, RECIPIENT)).toBe(0n)
        })

        it('with explicit gas is mined and reverts: the batch stops there and the third call is never sent', async () => {
            const setup = await setUp()
            const { env, owner, token } = setup
            const calls = await revertingBatch(setup)
            // Not reachable through validation, which drops a call's gas; the
            // executor still carries one, and this is the only way its
            // reverted-receipt branch meets a real revert.
            const request: EthereumCallBatchRequest = {
                from: owner.address,
                calls: calls.map((call, index) => ({
                    from: owner.address,
                    to: call.to,
                    value: 0n,
                    data: call.data,
                    ...(index === 1 && { gas: REVERTING_CALL_GAS }),
                })),
            }

            const { prepared, raws, positions } = await startBatch(
                setup,
                request,
            )
            const batch = await settledBatch(
                env,
                prepared.batchId,
                owner.address,
            )

            expect(batch).toMatchObject({ outcome: 'reverted', position: 1 })
            expect(batch.txIds).toHaveLength(2)
            expect(positions).toEqual([[1]])
            expect(transactionOf(raws[1]).gas).toBe(REVERTING_CALL_GAS)
            const reverted = await nodeTransactionOf(env, batch.txIds[1])
            expect(BigInt(reverted.nonce)).toBe(1n)
            expect(reverted.input).toBe(calls[1].data)

            const status = await readEthereumCallsStatus(
                env.ctx,
                env.evmChain,
                batch,
            )
            expect(status.status).toBe(600)
            expect(
                status.receipts.map(receipt => receipt.transactionHash),
            ).toEqual(batch.txIds)
            expect(status.receipts.map(receipt => receipt.status)).toEqual([
                '0x1',
                '0x0',
            ])
            await expectNothingSentPast(env, owner.address, 2)
            expect(await allowanceOf(env, token, owner.address)).toBe(ALLOWANCE)
            expect(await balanceOf(env, token, RECIPIENT)).toBe(0n)
        })
    })

    it('refuses a later call whose re-priced fee exceeds the reviewed ceiling, sending nothing after it', async () => {
        const setup = await setUp()
        const { env, owner, token } = setup
        const warn = vi.spyOn(logger, 'warn')
        const calls = [
            { to: token, data: await calldataOf.approve() },
            {
                to: token,
                data: await calldataOf.transfer(RECIPIENT, FIRST_AMOUNT),
            },
            {
                to: token,
                data: await calldataOf.transfer(
                    SECOND_RECIPIENT,
                    SECOND_AMOUNT,
                ),
            },
        ]
        const restoredBaseFee = await nextBaseFeeOf(env)
        let raisedBaseFee = 0n

        try {
            const { prepared, positions } = await startBatch(
                setup,
                validatedBatch(owner.address, calls),
                {
                    depsFor: ({ maxFeePerGasCeiling }) => ({
                        // Runs once the first call has its receipt and before
                        // the second is priced: the network's fee jumps in between.
                        whenUnlocked: async () => {
                            if (raisedBaseFee > 0n) return
                            // The app prices at twice the base fee plus a tip,
                            // so a base fee at the ceiling prices well past it.
                            raisedBaseFee = maxFeePerGasCeiling
                            await setNextBaseFee(env, raisedBaseFee)
                        },
                    }),
                },
            )
            const ceiling = (prepared.request as PreparedEthereumCallBatch)
                .maxFeePerGasCeiling
            const batch = await settledBatch(
                env,
                prepared.batchId,
                owner.address,
            )

            expect(raisedBaseFee).toBe(ceiling)
            expect(batch).toMatchObject({ outcome: 'failed', position: 1 })
            expect(batch.txIds).toHaveLength(1)
            expect(positions).toEqual([])
            const [refusal] = warningsAbout(
                warn,
                '[ethereum] a batched call could not be signed',
            )
            expect(refusal.position).toBe(1)
            expect((refusal.error as Error).message).toBe(
                'The network fee rose past what the batch review allows',
            )

            const status = await readEthereumCallsStatus(
                env.ctx,
                env.evmChain,
                batch,
            )
            expect(status.status).toBe(600)
            expect(status.receipts.map(receipt => receipt.status)).toEqual([
                '0x1',
            ])
            await expectNothingSentPast(env, owner.address, 1)
            expect(await balanceOf(env, token, RECIPIENT)).toBe(0n)
            expect(await balanceOf(env, token, SECOND_RECIPIENT)).toBe(0n)
        } finally {
            await setNextBaseFee(env, restoredBaseFee)
        }
    })

    it('resumes a batch the app lost mid-run by rebroadcasting the bytes it already signed, then finishes it', async () => {
        const setup = await setUp()
        const { env, owner, token } = setup
        const warn = vi.spyOn(logger, 'warn')
        const calls = [
            { to: token, data: await calldataOf.approve() },
            {
                to: token,
                data: await calldataOf.transfer(RECIPIENT, FIRST_AMOUNT),
            },
            {
                to: token,
                data: await calldataOf.transfer(
                    SECOND_RECIPIENT,
                    SECOND_AMOUNT,
                ),
            },
        ]
        const proxy = await withSeverableRpc(env.chain)
        const lostCtx: ChainContext = {
            ...env.ctx,
            getEndpoints: () => ({ [env.scope.networkId]: proxy.url }),
        }

        try {
            // The node goes away once the second call is signed, before the
            // executor records it or sends it: the app's last act is the save.
            const { prepared, raws, positions, deps } = await startBatch(
                setup,
                validatedBatch(owner.address, calls),
                {
                    ctx: lostCtx,
                    onSigned: position => {
                        if (position === 1) proxy.sever()
                    },
                },
            )
            await vi.waitFor(
                () =>
                    expect(
                        warningsAbout(
                            warn,
                            '[ethereum] a batch stopped before it settled',
                        ),
                    ).toHaveLength(1),
                { timeout: SETTLE_DEADLINE_MS },
            )
            const stopped = await findTransactionBatch({
                chainId: env.scope.chainId,
                batchId: prepared.batchId,
                senders: [owner.address],
            })
            expect(stopped).toMatchObject({
                outcome: 'running',
                position: 1,
                signedRaw: raws[1],
            })
            const lostHash = stopped!.txIds[1]
            // The send failed in transport, so the ledger can't say it was
            // refused: the attempt stays open, which is what licenses a resend.
            expect(
                (
                    await getSubmissionAttemptsByTxIds({
                        scope: env.scope,
                        txIds: [lostHash],
                        statuses: [
                            'submitted',
                            'unknown',
                            'confirmed',
                            'failed',
                            'replaced',
                        ],
                    })
                ).map(attempt => attempt.status),
            ).toEqual(['unknown'])
            // Nothing past the first call reached the node before the loss.
            await expectNothingSentPast(env, owner.address, 1)

            await resumeEthereumCallBatches(env.ctx, env.evmChain, deps)
            const batch = await settledBatch(
                env,
                prepared.batchId,
                owner.address,
            )

            expect(batch.outcome).toBe('confirmed')
            // Round-trip: the resend is the bytes signed before the loss, not
            // a second signature over the same call.
            expect(batch.txIds[1]).toBe(lostHash)
            expect(positions).toEqual([[1], [2]])
            expect(raws).toHaveLength(3)
            for (const [index, hash] of batch.txIds.entries()) {
                const tx = await nodeTransactionOf(env, hash)
                expect(BigInt(tx.nonce)).toBe(BigInt(index))
                expect(tx.input).toBe(calls[index].data)
            }
            expect(
                (await readEthereumCallsStatus(env.ctx, env.evmChain, batch))
                    .status,
            ).toBe(200)
            expect(await allowanceOf(env, token, owner.address)).toBe(ALLOWANCE)
            expect(await balanceOf(env, token, RECIPIENT)).toBe(FIRST_AMOUNT)
            expect(await balanceOf(env, token, SECOND_RECIPIENT)).toBe(
                SECOND_AMOUNT,
            )
        } finally {
            await proxy.close()
        }
    })
})
