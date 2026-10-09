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

import { SignedTransaction } from 'algosdk'
import type { PeraTransaction } from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import {
    bytesToHex,
    encodeToBase64,
    logger,
    withTimeout,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    isTransactionRequest,
    type SignRequest,
    type StaleGroupReason,
} from '@perawallet/wallet-core-signing'
import {
    AlgodErrorCode,
    asAlgosdkTransaction,
    getExpectedGenesisHash,
    isAlgodError,
    toAlgodError,
} from '../blockchain'
import { simulateSignedGroup } from './feeCoverage'

// How long a WalletConnect request may wait on this check before its sheet
// shows; past it the request is presented as if the check never ran.
export const STALE_CHECK_TIMEOUT_MS = 3000

/** Resolves with algod's failure message for the group, or `null` if it would pass. */
export type SimulateOriginalGroup = (
    group: readonly PeraTransaction[],
    network: Network,
) => Promise<Nullable<string>>

/**
 * The dApp's own bytes, group ids intact. Rebuilding the group (as the
 * balance-impact simulation does) would change every txid, so a confirmed
 * group could never match algod's duplicate check.
 */
const simulateOriginalGroup: SimulateOriginalGroup = (group, network) =>
    simulateSignedGroup(
        group.map(
            txn => new SignedTransaction({ txn: asAlgosdkTransaction(txn) }),
        ),
        network,
    )

/**
 * A request may concatenate several atomic groups and ungrouped transactions;
 * algod simulates one group at a time.
 */
export const partitionByGroup = (
    txs: readonly PeraTransaction[],
): PeraTransaction[][] => {
    const partitions: PeraTransaction[][] = []
    let previousGroup: Nullable<string> = null
    for (const txn of txs) {
        const group = txn.group ? bytesToHex(txn.group) : null
        const current = partitions.at(-1)
        if (current && group !== null && group === previousGroup) {
            current.push(txn)
        } else {
            partitions.push([txn])
        }
        previousGroup = group
    }
    return partitions
}

/**
 * Simulating re-runs algod's admission checks: a confirmed transaction fails
 * with "transaction already in ledger" and an expired one with "txn dead".
 * "txn dead" also covers a first valid round still ahead, which can land
 * later, hence the round comparison.
 */
export const staleReasonFor = (
    failureMessage: string,
    group: readonly PeraTransaction[],
): Nullable<StaleGroupReason> => {
    const algodError = toAlgodError(new Error(failureMessage))
    if (isAlgodError(algodError, AlgodErrorCode.DUPLICATE_TXN)) {
        const { txId } = algodError.params
        return group.some(txn => txn.txID() === txId)
            ? 'already-on-chain'
            : null
    }
    if (isAlgodError(algodError, AlgodErrorCode.EXPIRED_TXN)) {
        const { currentRound, lastValid } = algodError.params
        return currentRound !== undefined &&
            lastValid !== undefined &&
            currentRound > lastValid
            ? 'expired'
            : null
    }
    return null
}

/**
 * algod checks a transaction's round window before its genesis, so one from
 * another network can read as expired; the analyzer's network-mismatch error
 * is the honest answer for it.
 */
const isOnNetwork = (
    txs: readonly PeraTransaction[],
    network: Network,
): boolean => {
    const expected = getExpectedGenesisHash(network)
    return (
        !!expected &&
        txs.every(
            txn =>
                !!txn.genesisHash &&
                encodeToBase64(txn.genesisHash) === expected,
        )
    )
}

// Sequential so a live request costs one simulation. Stale only when every
// group is: a request mixing a landed group with a live one still has
// something worth signing.
const classifyGroups = async (
    groups: readonly PeraTransaction[][],
    network: Network,
    simulate: SimulateOriginalGroup,
): Promise<Nullable<StaleGroupReason>> => {
    let reason: Nullable<StaleGroupReason> = null
    for (const group of groups) {
        const failure = await simulate(group, network)
        const groupReason = failure ? staleReasonFor(failure, group) : null
        if (!groupReason) return null
        reason = reason === 'already-on-chain' ? reason : groupReason
    }
    return reason
}

export const findStaleGroupReason = async (
    request: SignRequest,
    {
        simulate = simulateOriginalGroup,
        network = useNetworkStore.getState().network,
        timeoutMs = STALE_CHECK_TIMEOUT_MS,
    }: {
        simulate?: SimulateOriginalGroup
        network?: Network
        timeoutMs?: number
    } = {},
): Promise<Nullable<StaleGroupReason>> => {
    if (!isTransactionRequest(request)) return null
    const txs = request.groupContext ?? request.txs
    if (txs.length === 0) return null

    try {
        if (!isOnNetwork(txs, network)) return null
        return await withTimeout(
            classifyGroups(partitionByGroup(txs), network, simulate),
            timeoutMs,
            'Stale-group simulation',
        )
    } catch (error) {
        logger.debug('Stale-group check inconclusive; request presented', {
            id: request.id,
            error,
        })
        return null
    }
}
