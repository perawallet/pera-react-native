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
    markSubmissionUnknown,
    recordSubmissionAttempt,
    resolveSubmissionAttempt,
    SubmissionError,
    type SubmissionFlow,
    type SubmissionHistoryEntry,
} from '@perawallet/wallet-core-signing'
import { EvmErrorCode, evmErrorCodeOf, toEvmError } from '../blockchain/errors'
import type { EvmChain } from '../chains/types'

// Nodes word a resend of a pooled transaction differently.
const ALREADY_KNOWN = /already known|\bknown transaction|alreadyknown/i

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

// Wei: gas limit x max fee per gas, the most the transaction can be charged.
// The signing adapter signs EIP-1559 only, so there is no legacy gasPrice.
const maxFeeOf = ({
    gas,
    maxFeePerGas,
}: ReturnType<typeof parseTransaction>): Decimal | undefined =>
    gas === undefined || maxFeePerGas === undefined
        ? undefined
        : new Decimal((gas * maxFeePerGas).toString())

const bestEffort = async (label: string, write: () => Promise<unknown>) => {
    try {
        await write()
    } catch (error) {
        logger.warn(`ethereum submission ledger: ${label} failed`, { error })
    }
}

/**
 * Writes each transaction's ledger row before sending it, so a send that gets
 * no answer still holds its nonce. A ledger write failure never blocks the
 * send.
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
        const fee = maxFeeOf(parsed)
        const sender = await recoverTransactionAddress({
            serializedTransaction,
        })
        let attemptId: string | undefined
        await bestEffort('record', async () => {
            attemptId = await recordSubmissionAttempt({
                db,
                scope,
                txIds: [keccak256(serializedTransaction)],
                flow,
                sender,
                nonce,
                maxFee: fee,
                historyEntry: entry && { ...entry, ...(fee && { fee }) },
            })
        })
        try {
            txIds.push(
                ...(await submitEthereumTransactions(client, [bytes], chain)),
            )
        } catch (error) {
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
