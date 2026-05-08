/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    type PeraTransaction,
    Transaction,
    groupTransactions,
} from '@perawallet/wallet-core-blockchain'

import { InvalidSignableDataError } from '../pipeline/errors'

const bytesEqual = (
    a: Uint8Array | undefined,
    b: Uint8Array | undefined,
): boolean => {
    if (!a && !b) return true
    if (!a || !b) return false
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false
    }
    return true
}

/**
 * Verifies that any transactions claiming to be part of an atomic group
 * actually form a valid group. Catches cases where a dApp sends transactions
 * with a stale group ID — e.g. a 5-tx group with one tx removed before send,
 * which would otherwise reach the signer and only fail on submission to algod.
 *
 * Must run on the FULL set of transactions in a request — including those
 * not signed by any of the user's accounts — because the group hash is
 * computed over every transaction algod will see. Running on a per-signer
 * subset would always fail for legitimate cross-account groups (e.g. express
 * send, where the receiver signs the opt-in).
 *
 * Rules:
 * - If no transaction has a group, nothing to validate.
 * - All transactions in the request must share the group (no mixed groups,
 *   and no partial groupings).
 * - The recomputed group ID over the present transactions must equal the
 *   claimed group ID.
 *
 * Throws `InvalidSignableDataError` (non-retryable) on any violation.
 */
export const validateTransactionGroupIntegrity = (
    transactions: PeraTransaction[],
): void => {
    const groupedTxns = transactions.filter(tx => tx.group)
    if (groupedTxns.length === 0) return

    const claimedGroup = groupedTxns[0].group!
    for (const tx of groupedTxns) {
        if (!bytesEqual(tx.group, claimedGroup)) {
            throw new InvalidSignableDataError(
                'transactions reference different group IDs',
            )
        }
    }

    if (groupedTxns.length !== transactions.length) {
        throw new InvalidSignableDataError(
            'some transactions are not part of the declared group',
        )
    }

    let computedGroup: Uint8Array | undefined
    try {
        const ungrouped = transactions.map(
            tx => new Transaction({ ...tx, group: undefined }),
        )
        computedGroup = groupTransactions(ungrouped)[0].group
    } catch (e) {
        throw new InvalidSignableDataError(
            `failed to recompute transaction group ID: ${
                e instanceof Error ? e.message : String(e)
            }`,
        )
    }

    if (!bytesEqual(computedGroup, claimedGroup)) {
        throw new InvalidSignableDataError(
            'group ID does not match the transactions provided',
        )
    }
}
