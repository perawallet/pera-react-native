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

import type { UnsignedTransaction } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    GenesisHashMismatchError,
    InvalidSignableDataError,
    isUnsignedTransactionRequest,
    type ChainSignerTransactions,
    type ReviewGroup,
    type TransactionSignRequest,
    type UnsignedTransactionSignRequest,
    type UnsignedTransactionsSignableData,
} from '@perawallet/wallet-core-signing'
import { toError } from '@perawallet/wallet-core-shared'
import { readAlgorandTransaction } from './planner'
import type { PeraTransaction } from '../blockchain/models/algosdk-shapes'
import {
    algorandGroupDataOf,
    algorandRequestDataOf,
    algorandReviewGroupOf,
} from './requestChainData'

export type AlgorandRequestGroup = Omit<
    ReviewGroup,
    'transactions' | 'groupContext'
> & {
    txs: PeraTransaction[]
    groupContext?: PeraTransaction[]
    rawTransactionsBase64?: string[]
}

/**
 * Null when a payload isn't a readable Algorand transaction for its scope, or
 * a request rehydrated in an older shape isn't chain-neutral; the reviewer
 * refuses such a request, so a guard has nothing to add.
 */
export const algorandRequestOf = (
    request: TransactionSignRequest,
): Nullable<AlgorandRequestGroup> => {
    if (!isUnsignedTransactionRequest(request)) return null
    try {
        const {
            groupContext,
            signerOverrides,
            signableIndices,
            feeAdjustments,
        } = algorandReviewGroupOf(request)
        return {
            txs: algorandTransactionsOf(request.txs),
            groupContext: groupContext && algorandTransactionsOf(groupContext),
            signerOverrides,
            signableIndices,
            rawTransactionsBase64:
                algorandRequestDataOf(request)?.rawTransactionsBase64,
            feeAdjustments,
        }
    } catch {
        return null
    }
}

export const readableAlgorandTransaction = (
    unsigned: UnsignedTransaction,
): Nullable<PeraTransaction> => {
    try {
        return readAlgorandTransaction(unsigned).transaction
    } catch {
        return null
    }
}

// A payload from a dApp that isn't Algorand's is untrusted data; a wrong
// genesis keeps its own user-facing error.
const readOrRefuse = (
    unsigned: UnsignedTransaction,
): ReturnType<typeof readAlgorandTransaction> => {
    try {
        return readAlgorandTransaction(unsigned)
    } catch (error) {
        if (error instanceof GenesisHashMismatchError) throw error
        throw new InvalidSignableDataError(toError(error).message)
    }
}

export const algorandTransactionsOf = (
    transactions: UnsignedTransaction[],
): PeraTransaction[] =>
    transactions.map(transaction => readOrRefuse(transaction).transaction)

// Read only to refuse a payload that isn't Algorand's; the signers decode it again.
export const readAlgorandTransactionsData = (
    data: UnsignedTransactionsSignableData,
): ChainSignerTransactions => {
    const { transactions } = data
    algorandTransactionsOf(transactions)
    const algorand = algorandGroupDataOf(data)
    return {
        transactions,
        indicesToSign:
            algorand?.indicesToSign ?? transactions.map((_, index) => index),
        ...(algorand?.rawTransactionsBase64 && {
            rawTransactionsBase64: algorand.rawTransactionsBase64,
        }),
    }
}

// An override naming any other account would key the group to one that signs nothing.
export const algorandSignedForAddresses = (
    request: UnsignedTransactionSignRequest,
): string[] => {
    const overrides = algorandRequestDataOf(request)?.signerOverrides
    return request.txs.map((unsigned, index) => {
        const { transaction, signer, multisig } = readOrRefuse(unsigned)
        const sender = transaction.sender.toString()
        const override = overrides?.get(index)
        if (override === undefined) return sender
        if (
            ![sender, signer, ...(multisig?.addresses ?? [])].includes(override)
        ) {
            throw new InvalidSignableDataError(
                `${override} can't sign transaction ${index}, which ${signer} signs for ${sender}`,
            )
        }
        return override
    })
}
