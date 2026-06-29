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

import { type PeraTransaction } from '@perawallet/wallet-core-blockchain'
import { Transaction, computeGroupID } from 'algosdk'
import {
    bytesEqual,
    bytesToHex,
    type Optional,
} from '@perawallet/wallet-core-shared'

import { InvalidSignableDataError } from '../pipeline/errors'

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
    validateGroupStructure(transactions, { recomputeGroupHash: true })
}

/**
 * Co-sign variant of {@link validateTransactionGroupIntegrity}: validates
 * partitioning and ARC-0001 contiguity but **skips the full-group hash
 * recompute**.
 *
 * This is the ONLY sanctioned way to relax the group-hash check, and it exists
 * for exactly one caller: the multisig **co-sign** path. The co-signer's device
 * holds only the multisig-signable subset of a larger atomic group (a swap
 * mixes in backend pre-signed pool/fee slots that never reach the co-signer),
 * so the full-group hash can never match over the subset. Full-group integrity
 * is enforced instead on the proposer/submitter — which holds the complete
 * group — and ultimately by algod at submission.
 *
 * Exposed as a dedicated, intent-revealing function (rather than a boolean on
 * the strict validator) so the relaxation can't be switched on by accident.
 *
 * Throws `InvalidSignableDataError` (non-retryable) on any violation.
 */
export const validateCosignSubsetIntegrity = (
    transactions: PeraTransaction[],
): void => {
    validateGroupStructure(transactions, { recomputeGroupHash: false })
}

const validateGroupStructure = (
    transactions: PeraTransaction[],
    { recomputeGroupHash }: { recomputeGroupHash: boolean },
): void => {
    // Partition by claimed group ID. Ungrouped transactions are independent
    // — ARC-0001 allows them alongside grouped txs in the same request.
    // Per spec, txns sharing a group ID must also be CONTIGUOUS in the
    // request; we track which group keys have been "closed" (left and not
    // returned to) and reject any later txn that re-opens one.
    const partitions = new Map<
        string,
        { group: Uint8Array; txs: PeraTransaction[] }
    >()
    const closedGroupKeys = new Set<string>()
    let activeGroupKey: string | null = null
    for (const tx of transactions) {
        if (!tx.group) {
            if (activeGroupKey !== null) {
                closedGroupKeys.add(activeGroupKey)
                activeGroupKey = null
            }
            continue
        }
        const key = bytesToHex(tx.group)
        if (key !== activeGroupKey) {
            if (closedGroupKeys.has(key)) {
                throw new InvalidSignableDataError(
                    'group transactions with the same group ID must be contiguous',
                )
            }
            if (activeGroupKey !== null) closedGroupKeys.add(activeGroupKey)
            activeGroupKey = key
        }
        const existing = partitions.get(key)
        if (existing) {
            existing.txs.push(tx)
        } else {
            partitions.set(key, { group: tx.group, txs: [tx] })
        }
    }

    if (partitions.size === 0) return

    // Co-sign subsets legitimately fail a full-group recompute (members are
    // missing), but contiguity above still guards against scattered/tampered
    // groups. Stop here when the caller opts out of the hash recompute.
    if (!recomputeGroupHash) return

    for (const { group: claimed, txs } of partitions.values()) {
        let computed: Optional<Uint8Array>
        try {
            // Clone each transaction and clear its group ID so the recompute
            // hashes the ungrouped form — the txID (and therefore the group
            // ID) folds in the `grp` field, so computing over the already
            // grouped txns would not reproduce the original group ID.
            const ungrouped = txs.map(tx => {
                const clone = Transaction.fromEncodingData(tx.toEncodingData())
                clone.group = undefined
                return clone
            })
            computed = computeGroupID(ungrouped)
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
