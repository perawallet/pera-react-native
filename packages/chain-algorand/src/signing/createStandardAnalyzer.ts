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
    AnalysisError,
    composeAnalysis,
    GenesisHashMismatchError,
    isAuthDataOriginMismatch,
    TransactionRoundTripError,
    type AlgorandTransactionSummary,
    type AnalysisContext,
    type AnalysisWarning,
    type DataAnalyzer,
    type DecodedGroup,
    type SignableGroup,
} from '@perawallet/wallet-core-signing'
import {
    encodeAlgorandAddress,
    classifyPeraTransaction,
    getExpectedGenesisHash,
} from '../blockchain'
import type { PeraTransaction } from '@perawallet/wallet-core-chain-contract'
import { validateTransactionRoundTrip } from './validateTransactionRoundTrip'
import { assertTransactionsMatchNetwork } from './assertTransactionsMatchNetwork'
import { algorandNetworkOf } from '../legacy-network'

// The round-trip and genesis errors are user-facing as they are; anything else
// is an analysis fault.
const toAnalysisError = (error: unknown): Error => {
    if (error instanceof TransactionRoundTripError) return error
    if (error instanceof GenesisHashMismatchError) return error
    return new AnalysisError(
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined,
    )
}

/** Fees, summaries and signers of a group, after the round-trip and genesis checks. */
export const decodeStandardGroup = async (
    group: SignableGroup,
    context: AnalysisContext,
): Promise<DecodedGroup> => {
    try {
        if (group.data.type !== 'transactions') {
            return {
                totalFees: 0n,
                transactionSummaries: [],
                signableAddresses: context.accounts.map(a => a.address),
            }
        }

        const { transactions, rawTransactionsBase64 } = group.data

        if (rawTransactionsBase64) {
            validateTransactionRoundTrip(transactions, rawTransactionsBase64)
        }

        const network = algorandNetworkOf(context.scope)
        assertTransactionsMatchNetwork(
            transactions,
            network,
            getExpectedGenesisHash(network),
        )

        // The machine already split the request into one group per authorizer,
        // so gate on `group.signerAddress`; `tx.sender` misses ARC-0001
        // `signers` / `authAddr` overrides.
        const signedByUs = context.accounts.some(
            a => a.address === group.signerAddress,
        )
        return {
            totalFees: signedByUs
                ? transactions.reduce((sum, tx) => sum + (tx.fee ?? 0n), 0n)
                : 0n,
            transactionSummaries: transactions.map(tx =>
                summarizeTransaction(tx),
            ),
            signableAddresses: signedByUs ? [group.signerAddress] : [],
        }
    } catch (error) {
        throw toAnalysisError(error)
    }
}

/**
 * Close-out and rekey warnings on transactions a wallet account signs. An ARC-60
 * `domain` is self-asserted, so one that doesn't match the origin the platform
 * saw is a relayed or phishing sign-in.
 */
export const detectStandardWarnings = (
    group: SignableGroup,
    decoded: DecodedGroup,
): AnalysisWarning[] => {
    try {
        if (group.data.type === 'transactions') {
            return decoded.signableAddresses.length > 0
                ? detectWarnings(group.data.transactions)
                : []
        }
        if (
            group.data.type === 'auth-data' &&
            isAuthDataOriginMismatch(
                group.data.authData.domain,
                group.source.verifiedOrigin,
            )
        ) {
            return [
                {
                    type: 'suspicious',
                    severity: 'danger',
                    message: `The sign-in domain "${group.data.authData.domain}" does not match the site that requested it (${group.source.verifiedOrigin}).`,
                },
            ]
        }
        return []
    } catch (error) {
        throw toAnalysisError(error)
    }
}

export const createStandardAnalyzer = (): DataAnalyzer => ({
    analyze: async (group, context) => {
        const decoded = await decodeStandardGroup(group, context)
        return composeAnalysis(decoded, detectStandardWarnings(group, decoded))
    },
})

/**
 * Create a human-readable summary of a transaction
 */
const summarizeTransaction = (
    tx: PeraTransaction,
): AlgorandTransactionSummary => {
    const type = classifyPeraTransaction(tx)
    const senderAddress = tx.sender.toString()

    const summary: AlgorandTransactionSummary = {
        type,
        sender: senderAddress,
    }

    // Like the close fields in detectWarnings, receiver/amount/assetIndex
    // live under the type-specific payload on an algosdk v3 Transaction,
    // never at the top level.
    if (tx.payment) {
        summary.receiver = tx.payment.receiver.toString()
        summary.amount = tx.payment.amount
    } else if (tx.assetTransfer) {
        summary.receiver = tx.assetTransfer.receiver.toString()
        summary.amount = tx.assetTransfer.amount
        summary.assetId = tx.assetTransfer.assetIndex
    }

    if (tx.note) {
        try {
            summary.note = new TextDecoder().decode(tx.note)
        } catch {
            // Note is not valid UTF-8, skip it
        }
    }

    return summary
}

/**
 * Detect warnings from transactions
 */
const detectWarnings = (transactions: PeraTransaction[]): AnalysisWarning[] => {
    const warnings: AnalysisWarning[] = []

    for (const tx of transactions) {
        // Close fields live under the type-specific payload (algosdk v3 /
        // algokit v10), never at the top level — only `rekeyTo` is a top-level
        // header field. Reading them off `tx` directly silently never matches,
        // which is how these danger warnings went dead.

        // Payment close: sweeps the account's entire remaining ALGO balance to
        // the target and closes the account.
        const paymentCloseTo = tx.payment?.closeRemainderTo
        if (paymentCloseTo) {
            warnings.push({
                type: 'close-account',
                severity: 'danger',
                message: `This transaction will close the account and send remaining balance to ${paymentCloseTo.toString()}`,
            })
        }

        // Asset opt-out: sweeps the sender's entire remaining balance of the
        // asset to the target.
        const assetCloseTo = tx.assetTransfer?.closeRemainderTo
        if (assetCloseTo) {
            warnings.push({
                type: 'close-account',
                severity: 'danger',
                message: `This transaction will opt-out and send remaining asset balance to ${assetCloseTo.toString()}`,
            })
        }

        // Check for rekey
        if ('rekeyTo' in tx && tx.rekeyTo) {
            const rekeyAddress = encodeAlgorandAddress(tx.rekeyTo.publicKey)
            warnings.push({
                type: 'rekey',
                severity: 'danger',
                message: `This transaction will rekey the account to ${rekeyAddress}`,
            })
        }
    }

    return warnings
}
