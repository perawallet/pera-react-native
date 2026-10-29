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
    BaseError,
    bytesToHex,
    getAddress,
    keccak256,
    parseTransaction,
    recoverTransactionAddress,
    RpcRequestError,
    TransactionNotFoundError,
    type Hex,
    type PublicClient,
    type TransactionSerialized,
} from 'viem'
import { Decimal } from 'decimal.js'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Database } from '@perawallet/wallet-core-database'
import { logger } from '@perawallet/wallet-core-shared'
import {
    getSubmissionAttemptsAtNonce,
    markSubmissionUnknown,
    OPEN_SUBMISSION_STATUSES,
    recordSubmissionAttempt,
    resolveSubmissionAttempt,
    SubmissionError,
    type SubmissionAttempt,
    type SubmissionFlow,
    type SubmissionHistoryEntry,
} from '@perawallet/wallet-core-signing'
import {
    EvmError,
    EvmErrorCode,
    evmErrorCodeOf,
    toEvmError,
} from '../blockchain/errors'
import type { EvmChain } from '../chains/types'
import { ethereumCallSummary } from '../signing/review'
import { readEvmSurcharge } from './fees'
import { meetsReplacementBump, readReplaceableTransaction } from './replacement'

// Nodes word a resend of a pooled transaction differently; Anvil says
// "transaction already imported".
const ALREADY_KNOWN =
    /already known|\bknown transaction|alreadyknown|already imported/i

/** Resolves false only when the node says it has no such transaction. */
// How long a receipt is awaited before the reconciler is left to settle the send.
export const ETHEREUM_CONFIRMATION_TIMEOUT_MS = 3 * 60_000

export const isTransactionKnownToNode = async (
    client: PublicClient,
    hash: Hex,
): Promise<boolean> => {
    try {
        await client.getTransaction({ hash })
        return true
    } catch (error) {
        if (error instanceof TransactionNotFoundError) return false
        throw error
    }
}

const messageOf = (error: unknown): string =>
    error instanceof BaseError
        ? `${error.shortMessage}\n${error.details}`
        : String(error)

// A resend after a lost response that already landed reads "nonce too low"
// while the node still returns our hash.
const isAccepted = async (
    client: PublicClient,
    hash: Hex,
    error: unknown,
): Promise<boolean> => {
    if (ALREADY_KNOWN.test(messageOf(error))) return true
    return (
        evmErrorCodeOf(error) === EvmErrorCode.NONCE_TOO_LOW &&
        (await isTransactionKnownToNode(client, hash))
    )
}

// Only a JSON-RPC reply is a verdict; a transport failure, timeout or rate
// limit says nothing about whether the node took the transaction.
const hasNodeVerdict = (error: unknown): boolean =>
    error instanceof BaseError &&
    error.walk(link => link instanceof RpcRequestError) !== null &&
    evmErrorCodeOf(error) !== EvmErrorCode.RATE_LIMITED

/**
 * The only path to `eth_sendRawTransaction`. Sends in order and resolves with
 * `keccak256(bytes)` per transaction; records nothing.
 */
export const submitEthereumTransactions = async (
    client: PublicClient,
    signedTransactions: readonly Uint8Array[],
    chain: EvmChain,
): Promise<string[]> => {
    const hashes: string[] = []
    for (const bytes of signedTransactions) {
        const serializedTransaction = bytesToHex(bytes)
        const hash = keccak256(serializedTransaction)
        try {
            await client.sendRawTransaction({ serializedTransaction })
        } catch (error) {
            let accepted = false
            let classification: 'rejected-by-node' | 'unknown-outcome' =
                hasNodeVerdict(error) ? 'rejected-by-node' : 'unknown-outcome'
            try {
                accepted = await isAccepted(client, hash, error)
            } catch {
                classification = 'unknown-outcome'
            }
            if (!accepted) {
                throw new SubmissionError(
                    [hash],
                    classification,
                    toEvmError(error, chain.row.nativeAsset.symbol),
                )
            }
        }
        hashes.push(hash)
    }
    return hashes
}

export type SubmitAndRecordEthereumTransactionsParams = {
    client: PublicClient
    chain: EvmChain
    scope: ChainScope
    signedTransactions: readonly Uint8Array[]
    flow: SubmissionFlow
    /** Index-aligned with `signedTransactions`; a transaction without one is left out of history. */
    historyEntries: readonly SubmissionHistoryEntry[]
    db?: Database
}

// Wei: gas limit x max fee per gas plus what the chain charges on top of gas,
// the most the transaction can be charged.
// The signing adapter signs EIP-1559 only, so there is no legacy gasPrice.
const maxFeeOf = (
    { gas, maxFeePerGas }: ReturnType<typeof parseTransaction>,
    surcharge: bigint,
): Decimal | undefined =>
    gas === undefined || maxFeePerGas === undefined
        ? undefined
        : new Decimal((gas * maxFeePerGas + surcharge).toString())

// The newest open attempt of the sender at this nonce under another hash; a
// transport retry of the same bytes shares the hash, so it replaces nothing.
const findReplacedAttempt = async (
    db: Database | undefined,
    scope: ChainScope,
    sender: string,
    nonce: number,
    hash: string,
): Promise<SubmissionAttempt | undefined> => {
    const open = await getSubmissionAttemptsAtNonce({
        db,
        scope,
        sender,
        nonce,
        statuses: OPEN_SUBMISSION_STATUSES,
    })
    return open.filter(attempt => attempt.txIds[0] !== hash).at(-1)
}

// Refused before the node sees it, so the bytes are provably not on chain.
const underpricedReplacement = (hash: string) =>
    new SubmissionError(
        [hash],
        'rejected-by-node',
        new EvmError(EvmErrorCode.REPLACEMENT_UNDERPRICED),
    )

const isUnderpricedReplacement = (
    replaced: SubmissionAttempt | undefined,
    parsed: ReturnType<typeof parseTransaction>,
): boolean => {
    const original =
        replaced?.rawTransaction != null
            ? readReplaceableTransaction(replaced.rawTransaction)
            : null
    if (!original) return false
    const { maxFeePerGas, maxPriorityFeePerGas } = parsed
    return (
        maxFeePerGas === undefined ||
        maxPriorityFeePerGas === undefined ||
        !meetsReplacementBump(original, { maxFeePerGas, maxPriorityFeePerGas })
    )
}

// "nonce too low" on a replacement means the transaction it re-priced, or one
// at the same nonce, confirmed first.
const asReplacementOutcome = (error: unknown): unknown =>
    error instanceof SubmissionError &&
    error.classification === 'rejected-by-node' &&
    evmErrorCodeOf(error.nodeError) === EvmErrorCode.NONCE_TOO_LOW
        ? new SubmissionError(
              error.txIds,
              error.classification,
              new EvmError(
                  EvmErrorCode.REPLACED_TRANSACTION_CONFIRMED,
                  {},
                  error.nodeError,
              ),
          )
        : error

const bestEffort = async (label: string, write: () => Promise<unknown>) => {
    try {
        await write()
    } catch (error) {
        logger.warn('Ethereum submission ledger step failed', {
            step: label,
            error,
        })
    }
}

// Priced from the signed bytes, so it is the oracle's answer for the transaction sent.
const readSurchargeOfSigned = async (
    client: PublicClient,
    chain: EvmChain,
    serializedTransaction: TransactionSerialized,
): Promise<bigint> => {
    if (chain.row.fee.kind !== 'eip1559-op-stack') return 0n
    try {
        const transaction = readReplaceableTransaction(serializedTransaction)
        if (!transaction) return 0n
        return await readEvmSurcharge(client, chain, transaction)
    } catch (error) {
        logger.warn('Ethereum surcharge read failed', { error })
        return 0n
    }
}

const isSameAddress = (a: string | null | undefined, b: string): boolean =>
    a != null && getAddress(a) === getAddress(b)

// Two sends built before either was recorded pick the same nonce, and the
// second would replace the first, leaving its dApp a hash that never mines.
// A speed-up resends the original's call and a cancel sends nothing to the
// sender; any other transaction at a held nonce is that collision.
const isNonceCollision = (
    replaced: SubmissionAttempt | undefined,
    parsed: ReturnType<typeof parseTransaction>,
    sender: string,
): boolean => {
    if (!replaced) return false
    const original =
        replaced.rawTransaction != null
            ? readReplaceableTransaction(replaced.rawTransaction)
            : null
    if (!original) return true
    const value = parsed.value ?? 0n
    const data = (parsed.data ?? '0x').toLowerCase()
    const isSpeedUp =
        (original.to == null
            ? parsed.to == null
            : isSameAddress(parsed.to, original.to)) &&
        value === (original.value ?? 0n) &&
        data === (original.data ?? '0x').toLowerCase()
    const isCancel =
        isSameAddress(parsed.to, sender) && value === 0n && data === '0x'
    return !isSpeedUp && !isCancel
}

/** The entry the send's build put on its unsigned transaction, read back from the signed bytes. */
export const historyEntryOfSigned = async (
    serializedTransaction: TransactionSerialized,
    chain: EvmChain,
): Promise<SubmissionHistoryEntry> => {
    const { to, value, data } = parseTransaction(serializedTransaction)
    const from = await recoverTransactionAddress({ serializedTransaction })
    return {
        summary: ethereumCallSummary(
            {
                from,
                to: to == null ? undefined : getAddress(to),
                value: value ?? 0n,
                data: data ?? '0x',
            },
            chain,
        ),
        chainData: { family: 'evm' },
    }
}

/**
 * Writes each transaction's ledger row before sending it, so a send that gets
 * no answer still holds its nonce. A ledger write failure never blocks the
 * send. A speed-up or cancel at a nonce an open attempt already holds replaces
 * it: the row links the two, and one that doesn't outbid the original by the
 * node's minimum bump is refused without being sent. Any other send at a held
 * nonce is refused the same way. On an OP-stack chain the recorded max fee
 * includes the oracle's fee for the signed bytes, or gas alone when that read fails.
 */
export const submitAndRecordEthereumTransactions = async ({
    client,
    chain,
    scope,
    signedTransactions,
    flow,
    historyEntries,
    db,
}: SubmitAndRecordEthereumTransactionsParams): Promise<string[]> => {
    const txIds: string[] = []
    for (const [index, bytes] of signedTransactions.entries()) {
        const serializedTransaction = bytesToHex(bytes) as TransactionSerialized
        const parsed = parseTransaction(serializedTransaction)
        const { nonce } = parsed
        const entry = historyEntries[index]
        const sender = await recoverTransactionAddress({
            serializedTransaction,
        })
        const hash = keccak256(serializedTransaction)
        // Started before the lookup so the oracle round trip doesn't sit between
        // the lookup and the ledger write, where an overlapping send at the same
        // nonce would slip past the collision check. Never rejects.
        const surcharge = readSurchargeOfSigned(
            client,
            chain,
            serializedTransaction,
        )
        let replaced: SubmissionAttempt | undefined
        if (nonce !== undefined) {
            await bestEffort('replacement lookup', async () => {
                replaced = await findReplacedAttempt(
                    db,
                    scope,
                    sender,
                    nonce,
                    hash,
                )
            })
        }
        if (isNonceCollision(replaced, parsed, sender)) {
            throw new SubmissionError(
                [hash],
                'rejected-by-node',
                new EvmError(EvmErrorCode.NONCE_TOO_LOW, {
                    symbol: chain.row.nativeAsset.symbol,
                }),
            )
        }
        if (isUnderpricedReplacement(replaced, parsed)) {
            throw underpricedReplacement(hash)
        }
        const fee = maxFeeOf(parsed, await surcharge)
        let attemptId: string | undefined
        await bestEffort('record', async () => {
            attemptId = await recordSubmissionAttempt({
                db,
                scope,
                txIds: [hash],
                flow,
                sender,
                nonce,
                maxFee: fee,
                historyEntry: entry && { ...entry, ...(fee && { fee }) },
                rawTransaction: serializedTransaction,
                replacesAttemptId: replaced?.id,
            })
        })
        try {
            txIds.push(
                ...(await submitEthereumTransactions(client, [bytes], chain)),
            )
        } catch (caught) {
            const error = replaced ? asReplacementOutcome(caught) : caught
            const id = attemptId
            if (id !== undefined) {
                await bestEffort('settle', () =>
                    error instanceof SubmissionError &&
                    error.classification === 'rejected-by-node'
                        ? resolveSubmissionAttempt({ db, id, status: 'failed' })
                        : markSubmissionUnknown({ db, id }),
                )
            }
            throw error
        }
    }
    return txIds
}
