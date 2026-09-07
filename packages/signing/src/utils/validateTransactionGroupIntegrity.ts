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

import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import { Transaction, computeGroupID } from 'algosdk'
import {
    bytesEqual,
    bytesToHex,
    type Optional,
} from '@perawallet/wallet-core-shared'

import { InvalidSignableDataError } from '../pipeline/errors'

/**
 * Catches a dApp sending a stale group ID — e.g. a 5-tx group with one removed
 * before send — which would otherwise reach the signer and only fail at algod.
 * Transactions are partitioned by `group` and each partition's recomputed id
 * must match what it claims; ungrouped transactions are independent and skipped.
 *
 * **Must be called over the FULL request payload, not the signable subset.** The
 * hash covers every transaction algod will see, so recomputing over a subset can
 * never match. External sources that pre-filter must preserve the original array
 * — see {@link TransactionSignRequest.groupContext}.
 *
 * Throws `InvalidSignableDataError` (non-retryable) on any violation.
 */
export const validateTransactionGroupIntegrity = (
    transactions: PeraTransaction[],
): void => {
    validateGroupStructure(transactions, { recomputeGroupHash: true })
}

/**
 * Validates partitioning and contiguity but **skips the full-group hash
 * recompute** — the only sanctioned relaxation, for exactly one caller.
 *
 * A co-signer's device holds only the multisig-signable subset of a larger
 * group (a swap mixes in backend pre-signed slots that never reach them), so the
 * full hash can never match. Integrity is enforced on the proposer instead, and
 * ultimately by algod.
 *
 * A dedicated function rather than a boolean flag, so it can't be switched on by
 * accident. Throws `InvalidSignableDataError` on any violation.
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
    // ARC-0001 allows ungrouped transactions alongside grouped ones, but
    // requires those sharing a group ID to be CONTIGUOUS — so closed group keys
    // are tracked and any later transaction re-opening one is rejected.
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
