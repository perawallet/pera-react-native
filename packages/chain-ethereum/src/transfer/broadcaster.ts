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

import { keccak256, type Hex } from 'viem'
import type {
    ChainContext,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { assertScopeUnchanged } from '@perawallet/wallet-core-chain-shared'
import { toError } from '@perawallet/wallet-core-shared'
import {
    SubmissionError,
    TransportError,
    type BroadcasterChainAdapter,
    type DataTransport,
} from '@perawallet/wallet-core-signing'
import { EvmError, EvmErrorCode, toEvmError } from '../blockchain/errors'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import { ETHEREUM_CHAIN_ID } from '../chain-id'
import {
    reconcileEthereumSubmissions,
    setEthereumSubmissionSettledHandler,
} from './reconcile'
import {
    submitAndRecordEthereumTransactions,
    submitEthereumTransactions,
} from './submission'

export const ETHEREUM_CONFIRMATION_TIMEOUT_MS = 3 * 60_000

export type EthereumBroadcasterOptions = {
    confirmationTimeoutMs?: number
}

export const createEthereumBroadcasterAdapter = (
    ctx: ChainContext,
    options: EthereumBroadcasterOptions = {},
): BroadcasterChainAdapter => {
    const timeout =
        options.confirmationTimeoutMs ?? ETHEREUM_CONFIRMATION_TIMEOUT_MS
    const clientFor = (scope: ChainScope) => createEvmClient(scope, ctx)

    return {
        chainId: ETHEREUM_CHAIN_ID,
        submit: (scope, signedTransactions) =>
            submitEthereumTransactions(clientFor(scope), signedTransactions),
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
            send: async result => {
                const { signedData } = result
                if (signedData.type !== 'signed-transactions') {
                    throw new TransportError(
                        'Ethereum transport only supports signed transactions',
                    )
                }
                assertScopeUnchanged(capturedScope)
                try {
                    const txIds = await submitAndRecordEthereumTransactions({
                        client: clientFor(capturedScope),
                        scope: capturedScope,
                        signedTransactions: signedData.signed.map(
                            signed => signed.bytes,
                        ),
                        flow: 'pipeline',
                    })
                    return { type: 'submitted', txIds }
                } catch (error) {
                    // Keeps the classification: wrapping would make a node
                    // refusal look retryable.
                    if (error instanceof SubmissionError) throw error
                    const cause = toError(error)
                    throw new TransportError(cause.message, cause)
                }
            },
        }),
        submitAndAutoRefresh: () =>
            Promise.reject(
                new Error(
                    'Ethereum submits through createSubmitTransport',
                ),
            ),
        // An unsigned request has no hash yet.
        isRequestGroupAlreadySubmitted: async () => false,
        findStaleGroupReason: async () => null,
        reconcileOpenSubmissions: () =>
            reconcileEthereumSubmissions({ getClient: clientFor }),
        deriveSubmissionAttemptFromBytes: bytesList => ({
            txIds: bytesList.map(bytes => keccak256(bytes)),
        }),
        // The handler takes Algorand's legacy Network; Ethereum confirms
        // through the reconciler.
        setOnConfirmedHandler: () => undefined,
        setSubmissionSettledHandler: setEthereumSubmissionSettledHandler,
        submitTimeoutError: timeoutMs =>
            new SubmissionError(
                [],
                'unknown-outcome',
                toEvmError(
                    new Error(
                        `Transaction submit timed out after ${timeoutMs}ms`,
                    ),
                ),
            ),
    }
}
