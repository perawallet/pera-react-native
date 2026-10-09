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
    asAlgosdkTransaction,
    createWalletAlgorandClient,
    decodeTransaction,
    encodeTransactionRaw,
    mapToDisplayableTransaction,
} from '../blockchain'
import type {
    PeraDisplayableTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { Network } from '@perawallet/wallet-core-config'

// Minimal structural view of algosdk's SimulateResponse — only the inner-txn
// path we walk. Structural typing keeps us decoupled from the SDK's model
// classes (which differ subtly across algosdk/algokit versions).
type PendingTxnLike = {
    txn?: { txn?: PeraTransaction }
    innerTxns?: PendingTxnLike[]
}
type SimulateResponseLike = {
    txnGroups?: { txnResults?: { txnResult?: PendingTxnLike }[] }[]
}

const collectInner = (
    pending: PendingTxnLike[] | undefined,
): PeraTransaction[] => {
    const out: PeraTransaction[] = []
    for (const node of pending ?? []) {
        const txn = node?.txn?.txn
        if (txn) {
            out.push(txn)
        }
        out.push(...collectInner(node?.innerTxns))
    }
    return out
}

/**
 * Inner transactions produced by a simulated group, flattened depth-first into
 * displayable transactions.
 *
 * App calls (swaps, lending, ASA factories, …) move funds through inner
 * transactions the raw signing group never reveals. Feeding these into
 * {@link computeBalanceImpact} alongside the top-level group is what makes the
 * balance impact accurate for dApp interactions — without it, a "swap 10 ALGO
 * for X" looks like it only spends 10 ALGO and receives nothing.
 *
 * Returns ONLY the inner transactions; callers append them to the already
 * decoded top-level group.
 */
export const flattenSimulatedInnerTransactions = (
    response: SimulateResponseLike | undefined,
): PeraDisplayableTransaction[] => {
    const inner: PeraTransaction[] = []
    for (const group of response?.txnGroups ?? []) {
        for (const result of group?.txnResults ?? []) {
            inner.push(...collectInner(result?.txnResult?.innerTxns))
        }
    }
    return inner
        .map(mapToDisplayableTransaction)
        .filter((tx): tx is PeraDisplayableTransaction => !!tx)
}

/**
 * Clone a transaction with its group id cleared.
 *
 * dApp interactions (swaps, NFT purchases) arrive as an atomic group, but
 * `composer.addTransaction` throws on any transaction that is "already in a
 * group". Without stripping it, the simulation throws for every grouped
 * request and the inner transactions are never surfaced.
 *
 * Cloned via the canonical encode/decode round-trip so the real signing
 * payload is never mutated; the composer re-groups in the same order, so the
 * simulated inner transactions are equivalent.
 */
export const ungroupForSimulation = (tx: PeraTransaction): PeraTransaction => {
    const clone = decodeTransaction(encodeTransactionRaw(tx))
    delete clone.group
    return clone
}

/**
 * Inner transactions of an unsigned algod simulation of `groupTxs`. Best
 * effort: a caller that can live without them should catch the rejection.
 */
export const simulateInnerTransactions = async (
    groupTxs: PeraTransaction[],
    network: Network,
): Promise<PeraDisplayableTransaction[]> => {
    const composer = createWalletAlgorandClient(network).newGroup()
    for (const tx of groupTxs) {
        composer.addTransaction(
            asAlgosdkTransaction(tx.group ? ungroupForSimulation(tx) : tx),
        )
    }
    const { simulateResponse } = await composer.simulate({
        skipSignatures: true,
        allowUnnamedResources: true,
    })
    // Structurally compatible with the flattener's minimal view; the cast
    // keeps us off the SDK's concrete model types.
    return flattenSimulatedInnerTransactions(
        simulateResponse as Parameters<
            typeof flattenSimulatedInnerTransactions
        >[0],
    )
}
