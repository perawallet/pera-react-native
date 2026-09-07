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

import type {
    DataAnalyzer,
    SignableGroup,
    SignableAnalysis,
    AnalysisContext,
    AnalysisWarning,
    TransactionSummary,
} from '../types'
import {
    AnalysisError,
    TransactionRoundTripError,
    GenesisHashMismatchError,
} from '../errors'
import {
    type PeraTransaction,
    encodeAlgorandAddress,
    classifyPeraTransaction,
    getExpectedGenesisHash,
} from '@perawallet/wallet-core-blockchain'
import { validateTransactionRoundTrip } from '../../utils/validateTransactionRoundTrip'
import { assertTransactionsMatchNetwork } from '../../utils/assertTransactionsMatchNetwork'
import { isArc60OriginMismatch } from '../../utils/arc60-wire'

/**
 * Creates the standard analyzer that provides basic analysis:
 * - Fee calculation
 * - Transaction summaries
 * - Warning detection (close, rekey, etc.)
 * - Signable address extraction
 */
export const createStandardAnalyzer = (): DataAnalyzer => {
    return {
        analyze: async (
            group: SignableGroup,
            context: AnalysisContext,
        ): Promise<SignableAnalysis> => {
            try {
                // Only analyze transaction data
                if (group.data.type !== 'transactions') {
                    return createNonTransactionAnalysis(group, context)
                }

                const { transactions, rawTransactionsBase64 } = group.data

                if (rawTransactionsBase64) {
                    validateTransactionRoundTrip(
                        transactions,
                        rawTransactionsBase64,
                    )
                }

                assertTransactionsMatchNetwork(
                    transactions,
                    context.network,
                    getExpectedGenesisHash(context.network),
                )

                const accountAddresses = new Set(
                    context.accounts.map(a => a.address),
                )

                // Calculate signable addresses
                const signableAddresses = findSignableAddresses(
                    transactions,
                    accountAddresses,
                )

                // Calculate total fees
                const totalFees = calculateTotalFees(
                    transactions,
                    signableAddresses,
                )

                // Create transaction summaries
                const transactionSummaries = transactions.map(tx =>
                    summarizeTransaction(tx),
                )

                // Detect warnings
                const warnings = detectWarnings(transactions, signableAddresses)

                // Calculate risk level
                const riskLevel = calculateRiskLevel(warnings)

                return {
                    totalFees,
                    transactionSummaries,
                    warnings,
                    signableAddresses: Array.from(signableAddresses),
                    riskLevel,
                }
            } catch (error) {
                if (error instanceof TransactionRoundTripError) throw error
                if (error instanceof GenesisHashMismatchError) throw error
                throw new AnalysisError(
                    error instanceof Error ? error.message : String(error),
                    error instanceof Error ? error : undefined,
                )
            }
        },
    }
}

/**
 * Creates analysis for non-transaction signable data (arbitrary data, Arc60).
 *
 * There are no transaction details to summarise here, but ARC-60 carries one
 * analysable risk: the SIWA `domain` is self-asserted by the request, so a
 * relayed/phishing request can bind to a domain the user trusts while actually
 * originating elsewhere. When the platform observed a trustworthy origin (the
 * webview host) and it doesn't match `domain`, flag it as a danger.
 */
const createNonTransactionAnalysis = (
    group: SignableGroup,
    context: AnalysisContext,
): SignableAnalysis => {
    const warnings: AnalysisWarning[] = []

    if (
        group.data.type === 'arc60' &&
        isArc60OriginMismatch(
            group.data.stdSigData.domain,
            group.source.verifiedOrigin,
        )
    ) {
        warnings.push({
            type: 'suspicious',
            severity: 'danger',
            message: `The sign-in domain "${group.data.stdSigData.domain}" does not match the site that requested it (${group.source.verifiedOrigin}).`,
        })
    }

    return {
        totalFees: 0n,
        transactionSummaries: [],
        warnings,
        signableAddresses: context.accounts.map(a => a.address),
        riskLevel: calculateRiskLevel(warnings),
    }
}

/**
 * Find addresses that need to sign (intersection of tx senders and user accounts)
 */
const findSignableAddresses = (
    transactions: PeraTransaction[],
    accountAddresses: Set<string>,
): Set<string> => {
    const signableAddresses = new Set<string>()

    for (const tx of transactions) {
        const senderAddress = tx.sender.toString()
        if (accountAddresses.has(senderAddress)) {
            signableAddresses.add(senderAddress)
        }
    }

    return signableAddresses
}

/**
 * Calculate total fees for transactions we're signing
 */
const calculateTotalFees = (
    transactions: PeraTransaction[],
    signableAddresses: Set<string>,
): bigint => {
    let totalFees = 0n

    for (const tx of transactions) {
        const senderAddress = tx.sender.toString()
        if (signableAddresses.has(senderAddress) && tx.fee) {
            totalFees += tx.fee
        }
    }

    return totalFees
}

/**
 * Create a human-readable summary of a transaction
 */
const summarizeTransaction = (tx: PeraTransaction): TransactionSummary => {
    const type = classifyPeraTransaction(tx)
    const senderAddress = tx.sender.toString()

    const summary: TransactionSummary = {
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
const detectWarnings = (
    transactions: PeraTransaction[],
    signableAddresses: Set<string>,
): AnalysisWarning[] => {
    const warnings: AnalysisWarning[] = []

    for (const tx of transactions) {
        const senderAddress = tx.sender.toString()

        // Only check transactions we're signing
        if (!signableAddresses.has(senderAddress)) {
            continue
        }

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

/**
 * Calculate overall risk level based on warnings
 */
const calculateRiskLevel = (
    warnings: AnalysisWarning[],
): 'low' | 'medium' | 'high' => {
    const hasDanger = warnings.some(w => w.severity === 'danger')
    const hasWarning = warnings.some(w => w.severity === 'warning')

    if (hasDanger) return 'high'
    if (hasWarning) return 'medium'
    return 'low'
}
