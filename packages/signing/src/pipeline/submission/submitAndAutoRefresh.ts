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

import { type AlgorandClient } from '@algorandfoundation/algokit-utils'
import { waitForConfirmation as algosdkWaitForConfirmation } from 'algosdk'
import type { PeraSignedTransaction } from '@perawallet/wallet-core-blockchain'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { logger, type Network } from '@perawallet/wallet-core-shared'
import { SubmissionError } from '../errors'
import { submitSignedTransactionGroup } from './submitSignedTransactionGroup'
import { extractAffectedWalletAddresses } from './extractAffectedWalletAddresses'
import { getOnConfirmedHandler } from './onConfirmedRegistry'
import type {
    AlgokitClientInterface,
    EncodeSignedTransactionsFn,
} from './types'

const DEFAULT_ROUNDS_TO_WAIT = 10

/**
 * Post-error verification window. Kept deliberately smaller than the main
 * confirmation wait: a transaction that reached the pool confirms within a
 * couple of rounds, and the whole submit + verify chain must finish inside
 * the signing machine's SUBMIT_TIMEOUT backstop.
 */
const VERIFY_ROUNDS_TO_WAIT = 4
const VERIFY_ATTEMPTS = 2
const VERIFY_RETRY_DELAY_MS = 2000

const defaultSleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms))

/**
 * Inputs for the testable core helper.
 */
export interface SubmitAndAutoRefreshCoreInput {
    algokit: AlgokitClientInterface
    encodeSignedTransactions: EncodeSignedTransactionsFn
    /**
     * Awaits chain confirmation for the given txId. Implementations should
     * resolve once the round is final and reject on timeout / network error.
     */
    waitForConfirmation: (txId: string) => Promise<void>
    /**
     * Short-window "did it land?" probe used only after an unknown-outcome
     * submit failure. Resolve = the transaction is confirmed on-chain;
     * reject = not found within the window (or the chain is unreachable).
     */
    verifyTxnLanded: (txId: string) => Promise<void>
    /** Injectable delay between verification attempts (tests). */
    sleep?: (ms: number) => Promise<void>
    walletAddresses: readonly string[]
    network: Network
    /**
     * Invoked after confirmation with the wallet-held addresses that
     * participated in the submitted group. Not invoked if confirmation
     * fails or no wallet-held addresses are involved.
     */
    onConfirmed: (
        affectedAddresses: string[],
        network: Network,
    ) => void | Promise<void>
    signedTxns: readonly PeraSignedTransaction[]
}

/**
 * Pure orchestrator: submits the group, returns immediately with txIds, and
 * spawns a fire-and-forget background task that awaits chain confirmation
 * and then invokes `onConfirmed` with the wallet-held addresses involved.
 *
 * - The returned promise resolves the moment algod accepts the submission.
 *   Confirmation latency is never on the user's signing-UX critical path.
 * - Confirmation timeouts and other background errors are swallowed and
 *   logged. Periodic sync is the safety net.
 *
 * Quantum (Falcon) groups are not special-cased here: a PQ-signed
 * transaction is just a `PeraSignedTransaction` with `pqsig` set, so
 * `encodeSignedTransaction` emits the node-ready bytes the same way it does
 * for any other transaction, and a quantum-signed group broadcasts through
 * the same path. It therefore reaches the chain only on a `pqsig`-capable
 * node, and no algod available today is one — mainnet, testnet and LocalNet
 * alike reject `pqsig` at submit, so a quantum-signed group cannot currently
 * be confirmed anywhere. See `docs/QUANTUM_PQ_INTEGRATION.md`.
 *
 * Exposed primarily for unit testing — call sites use {@link submitAndAutoRefresh}.
 */
export const submitAndAutoRefreshCore = async (
    input: SubmitAndAutoRefreshCoreInput,
): Promise<{ txIds: string[] }> => {
    let txIds: string[]
    try {
        txIds = await submitSignedTransactionGroup(
            input.algokit,
            input.encodeSignedTransactions,
            [...input.signedTxns],
        )
    } catch (error) {
        // A submit failure with no node verdict is ambiguous: the bytes may
        // already be in the pool (lost response, timeout). Check the chain
        // before letting "failed" propagate — this is exactly the case where
        // the report would be a lie (PERA-4896).
        if (
            !(error instanceof SubmissionError) ||
            error.classification !== 'unknown-outcome' ||
            error.txIds.length === 0
        ) {
            throw error
        }
        const landed = await verifyLandedWithRetries(input, error.txIds[0]!)
        if (!landed) throw error
        txIds = error.txIds
    }

    void backgroundConfirmAndRefresh(input, txIds)

    return { txIds }
}

const verifyLandedWithRetries = async (
    input: SubmitAndAutoRefreshCoreInput,
    txId: string,
): Promise<boolean> => {
    const sleep = input.sleep ?? defaultSleep
    for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt++) {
        try {
            await input.verifyTxnLanded(txId)
            logger.info(
                'submitAndAutoRefresh: unknown-outcome submission verified as landed',
                { txId },
            )
            return true
        } catch (error) {
            logger.warn(
                'submitAndAutoRefresh: post-error landing verification attempt failed',
                { error, txId, attempt },
            )
        }
        if (attempt < VERIFY_ATTEMPTS) {
            await sleep(VERIFY_RETRY_DELAY_MS)
        }
    }
    return false
}

const backgroundConfirmAndRefresh = async (
    input: SubmitAndAutoRefreshCoreInput,
    txIds: string[],
): Promise<void> => {
    if (txIds.length === 0) return

    try {
        await input.waitForConfirmation(txIds[0]!)
    } catch (error) {
        logger.warn(
            'submitAndAutoRefresh: confirmation wait failed; relying on periodic sync',
            { error, txIds },
        )
        return
    }

    const transactions = input.signedTxns.map(s => s.txn)
    const affected = extractAffectedWalletAddresses(
        transactions,
        input.walletAddresses,
    )
    if (affected.length === 0) return

    try {
        await input.onConfirmed(affected, input.network)
    } catch (error) {
        logger.warn('submitAndAutoRefresh: onConfirmed handler failed', {
            error,
        })
    }
}

/**
 * Drop-in replacement for {@link submitSignedTransactionGroup} that, after
 * algod accepts the submission, additionally awaits chain confirmation in
 * the background and triggers a targeted balance + transaction refresh for
 * any wallet-held address that participated in the group.
 *
 * Returns immediately with the txIds — confirmation latency is never on
 * the user's signing-UX critical path. Confirmation timeouts and refresh
 * failures are swallowed and logged; the periodic sync is the safety net.
 *
 * Used by:
 * - `createAlgodTransport` (the pipeline's algod transport)
 * - `useSignAndSubmitGroup` (callback-transport flows)
 * - `useSwapExecution` (mixes pre-signed bytes with user-signed; submits its
 *   own assembled groups)
 */
export const submitAndAutoRefresh = async (
    algokit: AlgokitClientInterface,
    encodeSignedTransactions: EncodeSignedTransactionsFn,
    signedTxns: PeraSignedTransaction[],
): Promise<string[]> => {
    const network = useNetworkStore.getState().network
    const accounts = useAccountsStore.getState().accounts
    const walletAddresses = accounts.map(a => a.address)

    const { txIds } = await submitAndAutoRefreshCore({
        algokit,
        encodeSignedTransactions,
        waitForConfirmation: txId =>
            // The runtime instance is always an AlgorandClient whose
            // .client.algod is the SDK AlgodClient; the cast bridges the
            // intentionally-narrow AlgokitClientInterface used for testing.
            // algosdk's signature is (client, txid, waitRounds).
            algosdkWaitForConfirmation(
                (algokit as unknown as AlgorandClient).client.algod,
                txId,
                DEFAULT_ROUNDS_TO_WAIT,
            ).then(() => undefined),
        verifyTxnLanded: txId =>
            algosdkWaitForConfirmation(
                (algokit as unknown as AlgorandClient).client.algod,
                txId,
                VERIFY_ROUNDS_TO_WAIT,
            ).then(() => undefined),
        walletAddresses,
        network,
        onConfirmed: (addresses, networkAtSubmission) => {
            const handler = getOnConfirmedHandler()
            return handler?.(addresses, networkAtSubmission)
        },
        signedTxns,
    })

    return txIds
}
