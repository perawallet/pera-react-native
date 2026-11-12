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
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import {
    GenesisHashMismatchError,
    InvalidSignableDataError,
    isUnsignedTransactionRequest,
    type ChainSignerTransactions,
    type ReviewGroup,
    type SignedFor,
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

export type AlgorandSigningSlot = { sender: string; signedFor: SignedFor }

/**
 * What the slot at `index` is signed for. An override naming any other account
 * would key the group to one that signs nothing. One naming the payload's
 * authorizer is that key: the chain checks the sender's auth address and never
 * follows the authorizer's own rekey. That holds for an override naming the
 * sender whose payload signs with the sender (an ARC-0001 `authAddr` equal to
 * the sender): its own key signs. A multisig participant still signs for the
 * account, so its rekey rules apply.
 * @throws InvalidSignableDataError for an override the payload doesn't sign with.
 */
export const algorandSigningSlotOf = (
    unsigned: UnsignedTransaction,
    override: Optional<string>,
    index: number,
): AlgorandSigningSlot => {
    const { transaction, signer, multisig } = readOrRefuse(unsigned)
    const sender = transaction.sender.toString()
    if (override === undefined) {
        return { sender, signedFor: { address: sender, isSigner: false } }
    }
    if (override === sender) {
        return {
            sender,
            signedFor: { address: sender, isSigner: signer === sender },
        }
    }
    if (multisig?.addresses.includes(override)) {
        return { sender, signedFor: { address: override, isSigner: false } }
    }
    if (override !== signer) {
        throw new InvalidSignableDataError(
            `${override} can't sign transaction ${index}, which ${signer} signs for ${sender}`,
        )
    }
    return { sender, signedFor: { address: override, isSigner: true } }
}

/**
 * Every slot of `request`, or null when the pipeline will refuse the request
 * anyway (a payload it can't read, another network's, or an override the
 * payload doesn't sign with), so a review check has nothing to add.
 */
export const algorandSigningSlotsOf = (
    request: UnsignedTransactionSignRequest,
): Nullable<AlgorandSigningSlot[]> => {
    const overrides = algorandRequestDataOf(request)?.signerOverrides
    try {
        return request.txs.map((unsigned, index) =>
            algorandSigningSlotOf(unsigned, overrides?.get(index), index),
        )
    } catch (error) {
        if (
            error instanceof InvalidSignableDataError ||
            error instanceof GenesisHashMismatchError
        ) {
            return null
        }
        throw error
    }
}

export const algorandSignedForAddresses = (
    request: UnsignedTransactionSignRequest,
): SignedFor[] => {
    const overrides = algorandRequestDataOf(request)?.signerOverrides
    return request.txs.map(
        (unsigned, index) =>
            algorandSigningSlotOf(unsigned, overrides?.get(index), index)
                .signedFor,
    )
}
