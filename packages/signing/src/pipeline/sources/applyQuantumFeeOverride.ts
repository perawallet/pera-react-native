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
    getSignerFor,
    isQuantumAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    calculateMinTxnFee,
    groupTransactions,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { Transaction } from 'algosdk'
import { bytesToHex } from '@perawallet/wallet-core-shared'

import { validateTransactionGroupIntegrity } from '../../utils/validateTransactionGroupIntegrity'

export type QuantumFeeAdjustment = {
    /** Index into the FULL group array (groupContext space) */
    index: number
    /** µAlgo, as received from the dApp */
    originalFee: bigint
    /** µAlgo, after raising to the PQ minimum */
    adjustedFee: bigint
}

export type ApplyQuantumFeeOverrideParams = {
    /** Full atomic payload as received (groupContext), NOT the signable subset */
    transactions: PeraTransaction[]
    /** Indices into `transactions` the wallet will sign */
    signableIndices: number[]
    /** Subset-position → authorizer address (ARC-0001 `signers`) */
    signerOverrides?: Map<number, string>
    accounts: WalletAccount[]
    /** Network suggested minimum fee in µAlgo (algod suggestedParams.minFee) */
    suggestedMinFee: bigint
    /** Remote-config base minimum txn fee in µAlgo */
    configMinTxnFee: bigint
    /** Remote-config PQ fee multiplier */
    pqMultiplier: bigint
}

export type ApplyQuantumFeeOverrideResult = {
    /** Same array reference as input when nothing was adjusted */
    transactions: PeraTransaction[]
    /** Empty when nothing was adjusted */
    adjustments: QuantumFeeAdjustment[]
}

/**
 * Raises dApp-set transaction fees to the post-quantum minimum on the
 * transactions a quantum account will sign in an external (WalletConnect)
 * request. Fees are only ever raised, never lowered, and non-quantum
 * transactions are returned byte-identical with their original object
 * references.
 *
 * Integrity model — validate as received, then modify, then re-group:
 * when at least one fee must be raised, the FULL incoming payload is first
 * checked with {@link validateTransactionGroupIntegrity} so a stale or
 * tampered incoming group throws `InvalidSignableDataError` before the
 * re-group could mask it. Affected transactions are then replaced with
 * clones (`Transaction.fromEncodingData` — the sanctioned clone pattern),
 * and every group partition containing an adjusted transaction is
 * re-grouped over its ENTIRE membership (also the txns Pera doesn't sign)
 * so the new `grp` is what algod will verify. Untouched partitions and
 * ungrouped transactions keep their original object references.
 *
 * Pooled-fee limitation: each quantum transaction is raised only to its own
 * minimum; pooled-fee groups where another transaction's surplus would
 * already cover the quantum transaction are intentionally still raised —
 * simpler and never underfunds (PQ-017 implementation note 3).
 *
 * ARC-0001 `groupContext` consumers see the modified group: the returned
 * array replaces the original payload for everything downstream (display,
 * signing, submission).
 */
export const applyQuantumFeeOverride = ({
    transactions,
    signableIndices,
    signerOverrides,
    accounts,
    suggestedMinFee,
    configMinTxnFee,
    pqMultiplier,
}: ApplyQuantumFeeOverrideParams): ApplyQuantumFeeOverrideResult => {
    // Congestion guard (same as resolveMinFeeForSender): multiply the max of
    // algod's suggested minimum and the configured base, at most once.
    const baseMinFee =
        suggestedMinFee > configMinTxnFee ? suggestedMinFee : configMinTxnFee
    const minFee = calculateMinTxnFee({
        baseMinFee,
        isPQSigner: true,
        pqMultiplier,
    })

    // Plan the adjustments: only signable txns whose effective authorizer
    // resolves to a quantum signer, and only when the fee is below the PQ
    // minimum (never lower a fee). Non-quantum senders are NEVER touched,
    // even if their fee is below the plain minimum.
    const adjustments: QuantumFeeAdjustment[] = []
    for (let i = 0; i < signableIndices.length; i++) {
        const groupIndex = signableIndices[i]
        const tx = transactions[groupIndex]
        const authorizer = signerOverrides?.get(i) ?? tx.sender.toString()
        const signer = getSignerFor(authorizer, accounts)
        if (signer === null || !isQuantumAccount(signer)) continue
        if (tx.fee >= minFee) continue
        adjustments.push({
            index: groupIndex,
            originalFee: tx.fee,
            adjustedFee: minFee,
        })
    }

    // Fast path: nothing to adjust — same array reference, zero behavior
    // change.
    if (adjustments.length === 0) {
        return { transactions, adjustments: [] }
    }

    // The group must be valid AS RECEIVED — a stale/tampered incoming group
    // throws before the re-group below could mask it.
    validateTransactionGroupIntegrity(transactions)

    const adjustedFeeByIndex = new Map<number, bigint>(
        adjustments.map(a => [a.index, a.adjustedFee]),
    )

    // Group partitions (keyed by the original claimed group ID) that contain
    // at least one adjusted transaction must be re-grouped in full.
    const affectedGroupKeys = new Set<string>()
    for (const { index } of adjustments) {
        const group = transactions[index].group
        if (group) affectedGroupKeys.add(bytesToHex(group))
    }

    // Clone only what changes: adjusted txns get the raised fee; every member
    // of an affected partition (also the ones Pera doesn't sign) is cloned
    // with its group cleared for the recompute. Everything else keeps its
    // original object reference.
    const result = transactions.map((tx, index) => {
        const adjustedFee = adjustedFeeByIndex.get(index)
        const inAffectedPartition =
            tx.group !== undefined &&
            affectedGroupKeys.has(bytesToHex(tx.group))
        if (adjustedFee === undefined && !inAffectedPartition) return tx

        const clone = Transaction.fromEncodingData(tx.toEncodingData())
        if (adjustedFee !== undefined) clone.fee = adjustedFee
        if (inAffectedPartition) clone.group = undefined
        return clone
    })

    // Re-group each affected partition so the new grp covers the ENTIRE
    // partition. groupTransactions (algosdk assignGroupID) mutates the clones
    // in place.
    for (const key of affectedGroupKeys) {
        const members: PeraTransaction[] = []
        for (let index = 0; index < transactions.length; index++) {
            const group = transactions[index].group
            if (group && bytesToHex(group) === key) members.push(result[index])
        }
        groupTransactions(members)
    }

    return { transactions: result, adjustments }
}
