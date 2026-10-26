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
    bytesToHex,
    keccak256,
    type Hex,
    type TransactionSerialized,
} from 'viem'
import type {
    ChainContext,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { assertScopeUnchanged } from '@perawallet/wallet-core-chain-shared'
import { logger, toError } from '@perawallet/wallet-core-shared'
import {
    SubmissionError,
    TransportError,
    type BroadcasterChainAdapter,
    type DataTransport,
} from '@perawallet/wallet-core-signing'
import { EvmError, EvmErrorCode, toEvmError } from '../blockchain/errors'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import type { EvmChain } from '../chains/types'
import {
    reconcileEthereumSubmissions,
    type SubmissionSettledHandlers,
} from './reconcile'
import {
    historyEntryOfSigned,
    submitAndRecordEthereumTransactions,
    submitEthereumTransactions,
} from './submission'

export const ETHEREUM_CONFIRMATION_TIMEOUT_MS = 3 * 60_000

export type EthereumBroadcasterOptions = {
    confirmationTimeoutMs?: number
}

export const createEvmBroadcasterAdapter = (
    ctx: ChainContext,
    chain: EvmChain,
    options: EthereumBroadcasterOptions = {},
): BroadcasterChainAdapter => {
    const timeout =
        options.confirmationTimeoutMs ?? ETHEREUM_CONFIRMATION_TIMEOUT_MS
    const clientFor = (scope: ChainScope) => createEvmClient(scope, ctx, chain)
    const settleHandlers: SubmissionSettledHandlers = new Map()
    const nativeSymbol = chain.row.nativeAsset.symbol

    return {
        chainId: chain.row.id,
        submit: (scope, signedTransactions) =>
            submitEthereumTransactions(
                clientFor(scope),
                signedTransactions,
                chain,
            ),
        waitForConfirmation: async (scope, txIds) => {
            const client = clientFor(scope)
            await Promise.all(
                txIds.map(async hash => {
                    const receipt = await client.waitForTransactionReceipt({
                        hash: hash as Hex,
                        timeout,
                        checkReplacement: false,
                    })
                    if (receipt.status === 'reverted') {
                        throw new EvmError(EvmErrorCode.REVERTED)
                    }
                }),
            )
        },
        createSubmitTransport: (capturedScope): DataTransport => ({
            send: async (result, source) => {
                const { signedData } = result
                if (signedData.type !== 'signed-transactions') {
                    throw new TransportError(
                        'Ethereum transport only supports signed transactions',
                    )
                }
                assertScopeUnchanged(capturedScope)
                let txIds: string[]
                try {
                    txIds = await submitAndRecordEthereumTransactions({
                        client: clientFor(capturedScope),
                        chain,
                        scope: capturedScope,
                        signedTransactions: signedData.signed.map(
                            signed => signed.bytes,
                        ),
                        historyEntries: signedData.historyEntries,
                        flow: 'pipeline',
                    })
                } catch (error) {
                    // Keeps the classification: wrapping would make a node
                    // refusal look retryable.
                    if (error instanceof SubmissionError) throw error
                    const cause = toError(error)
                    throw new TransportError(cause.message, cause)
                }
                // The transaction is in flight, so a failing callback must not
                // fail the pipeline; the dApp waits until its request expires.
                if (source.callbacks?.approve) {
                    try {
                        await source.callbacks.approve(result, { txIds })
                        return { type: 'submitted-and-answered', txIds }
                    } catch (error) {
                        logger.error(
                            'Ethereum transport: approve callback failed after submission',
                            { error },
                        )
                    }
                }
                return { type: 'submitted', txIds }
            },
        }),
        // Confirmation is the reconciler's, as for the pipeline's transport.
        submitAndAutoRefresh: async (scope, signedTransactions, options) => {
            const bytes = signedTransactions.map(signed => signed.bytes)
            return submitAndRecordEthereumTransactions({
                client: clientFor(scope),
                chain,
                scope,
                signedTransactions: bytes,
                historyEntries: await Promise.all(
                    bytes.map(serialized =>
                        historyEntryOfSigned(
                            bytesToHex(serialized) as TransactionSerialized,
                            chain,
                        ),
                    ),
                ),
                flow: options?.flow ?? 'pipeline',
            })
        },
        // An unsigned request has no hash yet.
        isRequestGroupAlreadySubmitted: async () => false,
        findStaleGroupReason: async () => null,
        reconcileOpenSubmissions: () =>
            reconcileEthereumSubmissions({
                chain,
                settleHandlers,
                getClient: clientFor,
            }),
        deriveSubmissionAttemptFromBytes: bytesList => ({
            txIds: bytesList.map(bytes => keccak256(bytes)),
        }),
        // Ethereum confirms through the reconciler, not a completion handler.
        setOnConfirmedHandler: () => undefined,
        setSubmissionSettledHandler: (flow, handler) => {
            if (handler === null) {
                settleHandlers.delete(flow)
            } else {
                settleHandlers.set(flow, handler)
            }
        },
        submitTimeoutError: timeoutMs =>
            new SubmissionError(
                [],
                'unknown-outcome',
                toEvmError(
                    new Error(
                        `Transaction submit timed out after ${timeoutMs}ms`,
                    ),
                    nativeSymbol,
                ),
            ),
    }
}
