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
    calculatePQFeeSurcharge,
    groupTransactions,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { Transaction } from 'algosdk'
import { bytesToHex } from '@perawallet/wallet-core-shared'

import { validateTransactionGroupIntegrity } from '../../utils/validateTransactionGroupIntegrity'

/**
 * Why a fee was raised. Today the only rule is the post-quantum surcharge for
 * quantum signers; future protocol rules (per-resource surcharges, a node
 * `simulate()`-derived requirement — see PQ-022) add members here without
 * changing the record shape. The `quantum-minimum` value predates the switch
 * from a minimum to a surcharge and is kept for wire/log compatibility.
 */
export type FeeAdjustmentReason = 'quantum-minimum'

export type FeeAdjustment = {
    /** Index into the FULL group array (groupContext space) */
    index: number
    /** µAlgo, as received from the dApp */
    originalFee: bigint
    /** µAlgo, after raising to the required minimum */
    adjustedFee: bigint
    /** Which rule required the raise */
    reason: FeeAdjustmentReason
}

export type AssignMinimumFeesToGroupParams = {
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

export type AssignMinimumFeesToGroupResult = {
    /** Same array reference as input when nothing was adjusted */
    transactions: PeraTransaction[]
    /** Empty when nothing was adjusted */
    adjustments: FeeAdjustment[]
}

/** Effective authorizer for the signable slot at `subsetIndex`. */
const resolveAuthorizer = (
    transactions: PeraTransaction[],
    signableIndices: number[],
    signerOverrides: Map<number, string> | undefined,
    subsetIndex: number,
): string =>
    signerOverrides?.get(subsetIndex) ??
    transactions[signableIndices[subsetIndex]].sender.toString()

/**
 * Cheap local precheck: does any signable slot resolve to a quantum signer?
 * Lets callers (see `useMinimumFeeCalculator`) skip the suggested-params
 * fetch entirely for non-quantum groups — the fee rules below only ever act
 * on quantum signers today.
 */
export const groupHasQuantumSigner = ({
    transactions,
    signableIndices,
    signerOverrides,
    accounts,
}: Pick<
    AssignMinimumFeesToGroupParams,
    'transactions' | 'signableIndices' | 'signerOverrides' | 'accounts'
>): boolean =>
    signableIndices.some((_, subsetIndex) => {
        const authorizer = resolveAuthorizer(
            transactions,
            signableIndices,
            signerOverrides,
            subsetIndex,
        )
        const signer = getSignerFor(authorizer, accounts)
        return signer !== null && isQuantumAccount(signer)
    })

/**
 * Raises transaction fees to what the signer type costs on chain, on the
 * transactions the wallet will sign in an externally-received group. The only
 * rule today is the post-quantum surcharge for quantum signers; fees are only
 * ever raised, never lowered, and transactions whose signer needs no raise are
 * returned byte-identical with their original object references.
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
 * Pooled fees: the surcharge is ADDED to the fee the dApp set, never clamped
 * to the PQ minimum. Fees pool across a group, so a fee above the base minimum
 * is budget for something else — most often an app call's inner transactions —
 * and clamping spends it on the signature instead, leaving the inner
 * transactions unfunded (`itxn_submit` then fails with "group fee too small").
 * Adding the premium keeps the dApp's own budget intact for every group shape.
 *
 * Underfunded groups are out of scope: a group whose fees don't cover its
 * pre-quantum cost already fails for an Ed25519 signer, and the wallet can't
 * know a group's true cost offline (inner-transaction count is only knowable
 * from `simulate` — PQ-022).
 *
 * ARC-0001 `groupContext` consumers see the modified group: the returned
 * array replaces the original payload for everything downstream (display,
 * signing, submission).
 */
export const assignMinimumFeesToGroup = ({
    transactions,
    signableIndices,
    signerOverrides,
    accounts,
    suggestedMinFee,
    configMinTxnFee,
    pqMultiplier,
}: AssignMinimumFeesToGroupParams): AssignMinimumFeesToGroupResult => {
    // Congestion guard (same as resolveMinFeeForSender): derive both the
    // surcharge and the floor from the max of algod's suggested minimum and
    // the configured base, at most once.
    const baseMinFee =
        suggestedMinFee > configMinTxnFee ? suggestedMinFee : configMinTxnFee
    const surcharge = calculatePQFeeSurcharge({ baseMinFee, pqMultiplier })
    const minFee = calculateMinTxnFee({
        baseMinFee,
        isPQSigner: true,
        pqMultiplier,
    })

    // Plan the adjustments: only signable txns whose effective authorizer
    // resolves to a quantum signer. Non-quantum senders are NEVER touched,
    // even if their fee is below the plain minimum.
    const adjustments: FeeAdjustment[] = []
    for (let i = 0; i < signableIndices.length; i++) {
        const groupIndex = signableIndices[i]
        const tx = transactions[groupIndex]
        const authorizer = resolveAuthorizer(
            transactions,
            signableIndices,
            signerOverrides,
            i,
        )
        const signer = getSignerFor(authorizer, accounts)
        if (signer === null || !isQuantumAccount(signer)) continue
        // Add the premium to what the dApp set, then floor at the PQ minimum
        // for a fee that wouldn't even cover a plain transaction. The floor
        // makes this pointwise ≥ the fee any given group carries today, so no
        // group that currently submits can start failing.
        const withSurcharge = tx.fee + surcharge
        const adjustedFee = withSurcharge > minFee ? withSurcharge : minFee
        if (adjustedFee <= tx.fee) continue
        adjustments.push({
            index: groupIndex,
            originalFee: tx.fee,
            adjustedFee,
            reason: 'quantum-minimum',
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
