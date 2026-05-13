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
import type { Optional } from '@perawallet/wallet-core-shared'

import { InvalidSignableDataError } from '../pipeline/errors'

const bytesEqual = (
    a: Optional<Uint8Array>,
    b: Optional<Uint8Array>,
): boolean => {
    if (!a && !b) return true
    if (!a || !b) return false
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false
    }
    return true
}

const bytesToHex = (b: Uint8Array): string =>
    Array.from(b, x => x.toString(16).padStart(2, '0')).join('')

/**
 * Verifies that any transactions claiming to be part of an atomic group
 * actually form a valid group. Catches cases where a dApp sends transactions
 * with a stale group ID — e.g. a 5-tx group with one tx removed before send,
 * which would otherwise reach the signer and only fail on submission to algod.
 *
 * Per ARC-0001, a single request may contain any combination of:
 * - Ungrouped (independent) transactions
 * - One or more complete atomic groups
 * Each group is validated independently; ungrouped transactions are skipped.
 *
 * **Must be called over the FULL request payload from the originating
 * source — not over the wallet's signable subset.** The group hash is
 * computed over every transaction algod will see; recomputing over a
 * subset (e.g. just the sender's tx in an express-send pair) would never
 * match the claimed group ID. External sources that pre-filter
 * (WalletConnect) must therefore preserve the original array — see
 * {@link TransactionSignRequest.groupContext}.
 *
 * Rules:
 * - Transactions are partitioned by their `group` field. Each partition
 *   must form a complete, valid group: the recomputed group ID over the
 *   members of that partition must equal the claimed group ID.
 * - Transactions with no `group` field are independent and skipped.
 *
 * Throws `InvalidSignableDataError` (non-retryable) on any violation.
 */
export const validateTransactionGroupIntegrity = (
    transactions: PeraTransaction[],
): void => {
    // Partition by claimed group ID. Ungrouped transactions are independent
    // — ARC-0001 allows them alongside grouped txs in the same request.
    const partitions = new Map<
        string,
        { group: Uint8Array; txs: PeraTransaction[] }
    >()
    for (const tx of transactions) {
        if (!tx.group) continue
        const key = bytesToHex(tx.group)
        const existing = partitions.get(key)
        if (existing) {
            existing.txs.push(tx)
        } else {
            partitions.set(key, { group: tx.group, txs: [tx] })
        }
    }

    if (partitions.size === 0) return

    for (const { group: claimed, txs } of partitions.values()) {
        let computed: Optional<Uint8Array>
        try {
            const ungrouped = txs.map(
                tx => new Transaction({ ...tx, group: undefined }),
            )
            computed = groupTransactions(ungrouped)[0].group
        } catch (e) {
            throw new InvalidSignableDataError(
                `failed to recompute transaction group ID: ${
                    e instanceof Error ? e.message : String(e)
                }`,
            )
        }

        if (!bytesEqual(computed, claimed)) {
            throw new InvalidSignableDataError(
                'group ID does not match the transactions provided',
            )
        }
    }
}
