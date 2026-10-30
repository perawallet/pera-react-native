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

import { bytesToHex, getAddress, hexToBytes, keccak256 } from 'viem'
import type { Address, Hex } from 'viem'
import type {
    ChainContext,
    SignedTransaction,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import {
    DappRequestCodedError,
    type PreparedDappBatch,
} from '@perawallet/wallet-core-connections'
import { whenAppUnlocked } from '@perawallet/wallet-core-security'
import {
    logger,
    type Optional,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    DuplicateTransactionBatchError,
    getRunningTransactionBatches,
    getSubmissionAttemptsByTxIds,
    getTransactionBatch,
    recordTransactionBatch,
    REVIEW_APPROVAL_TTL_MS,
    retireReviewApproval,
    signTransactionsInBackground,
    updateTransactionBatch,
    SubmissionError,
    type ReviewApproval,
    type ReviewApprovalRef,
    type SubmissionHistoryEntry,
    type SubmissionStatus,
    type TransactionBatch,
    type TransactionBatchOutcome,
} from '@perawallet/wallet-core-signing'
import { createEvmClient } from '../../blockchain/utils/createEvmClient'
import type { EvmChain } from '../../chains/types'
import {
    ETHEREUM_CONFIRMATION_TIMEOUT_MS,
    isTransactionKnownToNode,
    submitAndRecordEthereumTransactions,
    submitEthereumTransactions,
} from '../../transfer/submission'
import {
    buildEthereumSendTransaction,
    type EthereumSendTransactionRequest,
} from '../sendTransaction'
import { EIP5792_ERROR_CODE } from './codes'
import { readEvmTransaction } from '../../signing/adapter'
import { previewEthereumCall, type PreparedEthereumCallBatch } from './prepare'

/**
 * What a batch row holds: each call, with `value` in wei and `gas` in gas
 * units, and the most per gas a later call may be signed at, in wei; all
 * decimal strings.
 */
export type EthereumCallBatchPayload = {
    calls: { to: Address; value: string; data: Hex; gas?: string }[]
    maxFeePerGasCeiling: string
}

export type CallBatchExecutorDeps = {
    /** `approval` names the review the user approved the call on, and its place there. */
    signTransaction?: (
        tx: UnsignedTransaction,
        approval: ReviewApprovalRef,
    ) => Promise<SignedTransaction>
    whenUnlocked?: () => Promise<void>
    /** How long one call's receipt is awaited before the next sync tick picks the batch up. */
    confirmationTimeoutMs?: number
}

const BATCH_SIGNING_SOURCE = {
    name: 'Batched transaction',
    description: 'The next transaction of a batch you approved',
}

const OPEN_STATUSES: readonly SubmissionStatus[] = ['submitted', 'unknown']

const ALL_SUBMISSION_STATUSES: readonly SubmissionStatus[] = [
    ...OPEN_STATUSES,
    'confirmed',
    'failed',
    'replaced',
]

const signInBackground = async (
    tx: UnsignedTransaction,
    approval: ReviewApprovalRef,
): Promise<SignedTransaction> => {
    const [signed] = await signTransactionsInBackground(
        [tx],
        BATCH_SIGNING_SOURCE,
        approval,
    )
    return signed
}

// Batches this app instance is running, so a sync tick never starts a second
// run of one the approval already started.
const runningBatches = new Set<string>()

const toPayload = ({
    calls,
    maxFeePerGasCeiling,
}: PreparedEthereumCallBatch): EthereumCallBatchPayload => ({
    calls: calls.map(({ to, value, data, gas }) => ({
        to,
        value: value.toString(),
        data,
        ...(gas !== undefined && { gas: gas.toString() }),
    })),
    maxFeePerGasCeiling: maxFeePerGasCeiling.toString(),
})

const ceilingOf = (batch: TransactionBatch): bigint =>
    BigInt((batch.payload as EthereumCallBatchPayload).maxFeePerGasCeiling)

const callsOf = (batch: TransactionBatch): EthereumSendTransactionRequest[] => {
    const { calls } = batch.payload as EthereumCallBatchPayload
    const from = getAddress(batch.sender)
    return calls.map(({ to, value, data, gas }) => ({
        from,
        to,
        value: BigInt(value),
        data,
        ...(gas !== undefined && { gas: BigInt(gas) }),
    }))
}

type Verdict =
    | 'confirmed'
    | 'reverted'
    | 'failed'
    | 'pending'
    | 'never-sent'
    | 'resend'

/**
 * A signed call not yet handed to the node, with what its history row shows.
 * `isRecorded` when a ledger row already holds it, so a resend adds none.
 */
type Unsent = {
    signed: SignedTransaction
    entry: SubmissionHistoryEntry
    isRecorded: boolean
}

const historyEntryOf = (
    unsigned: UnsignedTransaction,
): SubmissionHistoryEntry => ({
    summary: unsigned.summary,
    chainData: unsigned.chainData,
})

/** The signed bytes the row kept for `txId`, when they hash to it. */
const savedSignedOf = (
    batch: TransactionBatch,
    txId: string,
): Optional<SignedTransaction> => {
    if (batch.signedRaw === null) return undefined
    const raw = batch.signedRaw as Hex
    return keccak256(raw) === txId
        ? { scope: batch.scope, id: txId, bytes: hexToBytes(raw) }
        : undefined
}

/**
 * Records the approved batch with its signed first call, then runs it in the
 * background. Resolves once the record exists, before anything is sent.
 */
export const startEthereumCallBatch = async (
    ctx: ChainContext,
    chain: EvmChain,
    prepared: PreparedDappBatch,
    first: SignedTransaction,
    approval: ReviewApproval,
    deps: CallBatchExecutorDeps = {},
): Promise<void> => {
    const request = prepared.request as PreparedEthereumCallBatch
    let batch: TransactionBatch
    try {
        batch = await recordTransactionBatch({
            scope: prepared.first.scope,
            sender: request.from,
            batchId: prepared.batchId,
            approvalToken: approval.token,
            payload: toPayload(request),
            txIds: [first.id],
            signedRaw: bytesToHex(first.bytes),
        })
    } catch (error) {
        if (error instanceof DuplicateTransactionBatchError) {
            throw new DappRequestCodedError(
                EIP5792_ERROR_CODE.duplicateId,
                'A batch with this id was already sent',
            )
        }
        throw error
    }
    runEthereumCallBatch(ctx, chain, batch, deps).catch((error: unknown) => {
        // Left running: the next sync tick resumes it.
        logger.warn('[ethereum] a batch stopped before it settled', {
            batchId: batch.batchId,
            error,
        })
    })
}

/**
 * Runs a batch from the position it reached until it settles or a receipt
 * outlasts the wait. Each call's hash and signed bytes are recorded before it
 * is sent, so a restart rebroadcasts the same bytes rather than signing a
 * second transaction. Resolves with the row as it was left; a batch already
 * running here, or no longer running, is returned untouched.
 */
export const runEthereumCallBatch = async (
    ctx: ChainContext,
    chain: EvmChain,
    batch: TransactionBatch,
    deps: CallBatchExecutorDeps = {},
): Promise<TransactionBatch> => {
    if (runningBatches.has(batch.id)) return batch
    runningBatches.add(batch.id)
    try {
        // The caller's row may predate a run that finished since it was read;
        // running from it would redo a settled position and send a call twice.
        const fresh = await getTransactionBatch({ id: batch.id })
        if (!fresh || fresh.outcome !== 'running') return fresh ?? batch
        return await run(ctx, chain, fresh, deps)
    } finally {
        runningBatches.delete(batch.id)
    }
}

const run = async (
    ctx: ChainContext,
    chain: EvmChain,
    batch: TransactionBatch,
    {
        signTransaction = signInBackground,
        whenUnlocked = whenAppUnlocked,
        confirmationTimeoutMs = ETHEREUM_CONFIRMATION_TIMEOUT_MS,
    }: CallBatchExecutorDeps,
): Promise<TransactionBatch> => {
    const { scope } = batch
    // Built on the batch's own network, whichever one is selected by now.
    const batchCtx: ChainContext = { ...ctx, getScope: () => scope }
    const client = createEvmClient(scope, ctx, chain)
    const calls = callsOf(batch)
    let current = batch
    let unsent: Optional<Unsent>
    // Sends this run made: one the node never saw failed before it left the
    // device, and resending or rebuilding it would only fail the same way.
    const attempted = new Set<string>()

    const save = async (
        txIds: string[],
        position: number,
        outcome: TransactionBatchOutcome,
        signedRaw: Nullable<string> = null,
    ): Promise<void> => {
        await updateTransactionBatch({
            id: batch.id,
            txIds,
            signedRaw,
            position,
            outcome,
        })
        current = { ...current, txIds, signedRaw, position, outcome }
        // A settled batch signs nothing more, so its review vouches for nothing.
        if (outcome !== 'running') {
            await retireReviewApproval({ token: batch.approvalToken }).catch(
                (error: unknown) => {
                    logger.warn('[ethereum] a batch approval was not retired', {
                        batchId: batch.batchId,
                        error,
                    })
                },
            )
        }
    }

    const send = async ({
        signed,
        entry,
        isRecorded,
    }: Unsent): Promise<boolean> => {
        try {
            await (isRecorded
                ? submitEthereumTransactions(client, [signed.bytes], chain)
                : submitAndRecordEthereumTransactions({
                      client,
                      chain,
                      scope,
                      signedTransactions: [signed.bytes],
                      flow: 'batch',
                      historyEntries: [entry],
                  }))
            return true
        } catch (error) {
            // Anything but a node's refusal may still have landed; the settle reads it.
            return !(
                error instanceof SubmissionError &&
                error.classification === 'rejected-by-node'
            )
        }
    }

    const settle = async (
        txId: string,
        canResend: boolean,
    ): Promise<Verdict> => {
        const hash = txId as Hex
        const attempts = await getSubmissionAttemptsByTxIds({
            scope,
            txIds: [txId],
            statuses: ALL_SUBMISSION_STATUSES,
        })
        if (!(await isTransactionKnownToNode(client, hash))) {
            const isOpen = attempts.some(({ status }) =>
                OPEN_STATUSES.includes(status),
            )
            // The reconciler wrote it off as dropped or replaced.
            if (attempts.length > 0 && !isOpen) return 'failed'
            // Recorded but never seen, as after a crash between the ledger
            // write and the send: the same bytes go out again.
            if (canResend) return 'resend'
            if (attempts.length === 0) return 'never-sent'
        }
        try {
            const receipt = await client.waitForTransactionReceipt({
                hash,
                timeout: confirmationTimeoutMs,
                checkReplacement: false,
            })
            return receipt.status === 'success' ? 'confirmed' : 'reverted'
        } catch {
            // No receipt yet: settled only once the reconciler has written the
            // attempt off as dropped or replaced.
            const settled = await getSubmissionAttemptsByTxIds({
                scope,
                txIds: [txId],
                statuses: ['failed', 'replaced'],
            })
            return settled.length > 0 ? 'failed' : 'pending'
        }
    }

    while (current.outcome === 'running') {
        const { position } = current
        const reached = current.txIds.slice(0, position)
        const txId = current.txIds[position]

        if (txId === undefined) {
            // Checked here, not left to the signing pipeline: it reads the
            // approval only for calls the chain won't auto-approve, so a
            // transfer would otherwise sign on an approval of any age.
            if (Date.now() - batch.createdAt > REVIEW_APPROVAL_TTL_MS) {
                await save(reached, position, 'failed')
                break
            }
            await whenUnlocked()
            let unsigned: UnsignedTransaction
            let signed: SignedTransaction
            try {
                unsigned = await buildEthereumSendTransaction(
                    batchCtx,
                    chain,
                    calls[position],
                )
                const { maxFeePerGas } = readEvmTransaction(
                    unsigned,
                    chain,
                ).transaction
                if (maxFeePerGas > ceilingOf(batch)) {
                    throw new Error(
                        'The network fee rose past what the batch review allows',
                    )
                }
                // The review listed the batch's calls in order, so a call's
                // position in the batch is its place on the review.
                signed = await signTransaction(unsigned, {
                    token: batch.approvalToken,
                    positions: [position],
                })
            } catch (error) {
                logger.warn('[ethereum] a batched call could not be signed', {
                    batchId: batch.batchId,
                    position,
                    error,
                })
                await save(reached, position, 'failed')
                break
            }
            await save(
                [...reached, signed.id],
                position,
                'running',
                bytesToHex(signed.bytes),
            )
            unsent = {
                signed,
                entry: historyEntryOf(unsigned),
                isRecorded: false,
            }
            continue
        }

        if (unsent?.signed.id === txId) {
            attempted.add(txId)
            const isSent = await send(unsent)
            unsent = undefined
            if (!isSent) {
                await save(current.txIds, position, 'failed')
                break
            }
        }

        const saved = savedSignedOf(current, txId)
        const verdict = await settle(
            txId,
            saved !== undefined && !attempted.has(txId),
        )
        if (verdict === 'pending') break
        if (verdict === 'resend') {
            if (!saved) break
            const attempts = await getSubmissionAttemptsByTxIds({
                scope,
                txIds: [txId],
                statuses: ALL_SUBMISSION_STATUSES,
            })
            unsent = {
                signed: saved,
                entry: historyEntryOf(
                    previewEthereumCall(
                        scope,
                        chain,
                        calls[position],
                        ceilingOf(batch),
                    ),
                ),
                isRecorded: attempts.length > 0,
            }
            continue
        }
        if (verdict === 'never-sent') {
            if (attempted.has(txId)) {
                await save(current.txIds, position, 'failed')
                break
            }
            await save(reached, position, 'running')
            continue
        }
        if (verdict === 'reverted' || verdict === 'failed') {
            await save(current.txIds, position, verdict)
            break
        }
        const isLast = position === calls.length - 1
        await save(
            current.txIds,
            isLast ? position : position + 1,
            isLast ? 'confirmed' : 'running',
        )
    }
    return current
}

/**
 * Picks up every batch the chain left running, as after an app restart. Never
 * throws: a sync tick calls it.
 */
export const resumeEthereumCallBatches = async (
    ctx: ChainContext,
    chain: EvmChain,
    deps: CallBatchExecutorDeps = {},
): Promise<void> => {
    try {
        const batches = await getRunningTransactionBatches({
            chainId: chain.row.id,
        })
        await Promise.all(
            batches.map(batch =>
                runEthereumCallBatch(ctx, chain, batch, deps).catch(
                    (error: unknown) => {
                        logger.warn('[ethereum] a batch could not resume', {
                            batchId: batch.batchId,
                            error,
                        })
                    },
                ),
            ),
        )
    } catch (error) {
        logger.warn('[ethereum] running batches could not be read', { error })
    }
}
