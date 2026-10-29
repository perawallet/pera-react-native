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
    GenesisHashMismatchError,
    InvalidSignableDataError,
    isAuthDataOriginMismatch,
    TransactionRoundTripError,
    type AnalysisContext,
    type AnalysisWarning,
    type DecodedGroup,
    type ReviewPolicy,
    type SignableGroup,
    type TransactionDecoder,
    type UnsignedTransactionsSignableData,
    type WarningDetector,
} from '@perawallet/wallet-core-signing'
import { encodeAlgorandAddress, getExpectedGenesisHash } from '../blockchain'
import { authorityOf } from '@perawallet/wallet-core-accounts'
import { toError } from '@perawallet/wallet-core-shared'
import { algorandAddressOf } from '../accounts/vocabulary'
import { algorandNetworkOf } from '../network-id'
import { assertTransactionsMatchNetwork } from './assertTransactionsMatchNetwork'
import { readAlgorandTransaction } from './planner'
import { algorandGroupDataOf } from './requestChainData'
import { validateTransactionRoundTrip } from './validateTransactionRoundTrip'
import type { PeraTransaction } from '../blockchain/models/algosdk-shapes'

// The round-trip and genesis errors are user-facing as they are; anything else
// is an analysis fault.
const toAnalysisError = (error: unknown): Error => {
    if (error instanceof TransactionRoundTripError) return error
    if (error instanceof GenesisHashMismatchError) return error
    return new AnalysisError(
        toError(error).message,
        error instanceof Error ? error : undefined,
    )
}

type AlgorandGroup = {
    transactions: PeraTransaction[]
    rawTransactionsBase64?: string[]
    /** Every planned signer the wallet holds. */
    heldSigners: string[]
}

const refuse = (reason: string): never => {
    throw new InvalidSignableDataError(reason)
}

// Chain-neutral transactions are reviewed as the Algorand transactions they
// carry, read through the planner's trust boundary. The payload names its own
// signers, so each one the wallet holds is listed for the user to approve,
// and an authority a wallet sender isn't rekeyed to is refused.
const algorandTransactionsOf = (
    data: UnsignedTransactionsSignableData,
    context: AnalysisContext,
): AlgorandGroup => {
    const heldSigners = new Set<string>()
    const transactions = data.transactions.map(unsigned => {
        let read: ReturnType<typeof readAlgorandTransaction>
        try {
            read = readAlgorandTransaction(unsigned)
        } catch (error) {
            if (error instanceof GenesisHashMismatchError) throw error
            return refuse(toError(error).message)
        }
        const sender = read.transaction.sender.toString()
        const senderAccount = context.accounts.find(
            a => algorandAddressOf(a) === sender,
        )
        if (senderAccount) {
            const authority =
                authorityOf(senderAccount, context.scope) ?? sender
            if (authority !== read.signer) {
                refuse(
                    `${sender} is authorised by ${authority}, not ${read.signer}`,
                )
            }
        }
        for (const signer of read.multisig?.addresses ?? [read.signer]) {
            if (context.accounts.some(a => algorandAddressOf(a) === signer)) {
                heldSigners.add(signer)
            }
        }
        return read.transaction
    })
    return {
        transactions,
        rawTransactionsBase64: algorandGroupDataOf(data)?.rawTransactionsBase64,
        heldSigners: [...heldSigners],
    }
}

/**
 * Summarises a group only once its bytes round-trip and its genesis is the
 * selected network's.
 */
const decode = async (
    group: SignableGroup,
    context: AnalysisContext,
): Promise<DecodedGroup> => {
    // Outside the analysis wrapper, so a payload refusal stays non-retryable.
    const algorand =
        group.data.type === 'transactions'
            ? algorandTransactionsOf(group.data, context)
            : undefined
    try {
        if (!algorand) {
            return {
                totalFees: 0n,
                signableAddresses: context.accounts.flatMap(
                    a => algorandAddressOf(a) ?? [],
                ),
            }
        }

        const { transactions, rawTransactionsBase64, heldSigners } = algorand

        if (rawTransactionsBase64) {
            validateTransactionRoundTrip(transactions, rawTransactionsBase64)
        }

        const network = algorandNetworkOf(context.scope)
        assertTransactionsMatchNetwork(
            transactions,
            network,
            getExpectedGenesisHash(network),
        )

        return {
            totalFees:
                heldSigners.length > 0
                    ? transactions.reduce((sum, tx) => sum + (tx.fee ?? 0n), 0n)
                    : 0n,
            signableAddresses: heldSigners,
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
const detect = (
    group: SignableGroup,
    decoded: DecodedGroup,
    context: AnalysisContext,
): AnalysisWarning[] => {
    try {
        if (group.data.type === 'transactions') {
            return decoded.signableAddresses.length > 0
                ? detectWarnings(
                      algorandTransactionsOf(group.data, context).transactions,
                  )
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

const detectWarnings = (transactions: PeraTransaction[]): AnalysisWarning[] => {
    const warnings: AnalysisWarning[] = []

    for (const tx of transactions) {
        // Close fields live under the type-specific payload (algosdk v3 /
        // algokit v10); only `rekeyTo` is a top-level header field. Reading
        // them off `tx` directly silently never matches.

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

        if ('rekeyTo' in tx && tx.rekeyTo) {
            const rekeyTarget = encodeAlgorandAddress(tx.rekeyTo.publicKey)
            warnings.push({
                type: 'rekey',
                severity: 'danger',
                message: `This transaction will rekey the account to ${rekeyTarget}`,
            })
        }
    }

    return warnings
}

export const algorandTransactionDecoder: TransactionDecoder = { decode }

export const algorandWarningDetector: WarningDetector = { detect }

// A local request is one the app built from the user's own choice, a rekey or
// close-out included, so every one signs without review whatever it warns about.
export const algorandReviewPolicy: ReviewPolicy = {
    autoApproveLocal: () => true,
}
