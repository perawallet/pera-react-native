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
import { plannerChainAdapters } from '../chain-adapter'
import { isUnsignedTransactionRequest } from './guards'
import type { FeeAdjustment, TransactionSignRequest } from './index'

/** The facts a source sends beside the transactions it asks to sign; its chain keeps them in `chainData`. */
export type SignRequestGroupFacts = {
    /**
     * The full group. A source that filters `txs` down to the subset the
     * wallet signs **must** set it, so the pipeline can check the group's
     * integrity; leave it unset when `txs` already is the full group.
     */
    groupContext?: UnsignedTransaction[]
    /** Which `groupContext` slots `txs` maps to. */
    signableIndices?: number[]
    /** Index in `txs` -> the account that signs for it, as the source named it; overrides the sender. */
    signerOverrides?: Map<number, string>
    /** Each of `txs` as the source sent it, base64, for the round-trip check. */
    rawTransactionsBase64?: string[]
    /** Fees the pipeline raised to a required minimum, indexed in `groupContext` space. */
    feeAdjustments?: FeeAdjustment[]
}

/** What a transaction request puts in front of the user. */
export type ReviewGroup = Omit<
    SignRequestGroupFacts,
    'rawTransactionsBase64'
> & {
    /** The full group when the source filtered `txs` down to a subset, else `txs`. */
    transactions: UnsignedTransaction[]
}

// Keyed by request so repeated reads return the same arrays: the signing
// sheet's display cache compares them by identity.
const followingGroups = new WeakMap<TransactionSignRequest, ReviewGroup>()

const withFollowing = (request: TransactionSignRequest): ReviewGroup => {
    const cached = followingGroups.get(request)
    if (cached) return cached
    const group: ReviewGroup = {
        transactions: [...request.txs, ...(request.followingTxs ?? [])],
        signableIndices: request.txs.map((_, index) => index),
    }
    followingGroups.set(request, group)
    return group
}

// A chain with no planner adapter sends no facts beside its transactions.
export const reviewGroupOf = (request: TransactionSignRequest): ReviewGroup => {
    if (isUnsignedTransactionRequest(request)) {
        const { chainId } = request.txs[0].scope
        if (plannerChainAdapters.has(chainId)) {
            return plannerChainAdapters.get(chainId).reviewGroupOf(request)
        }
    }
    return request.followingTxs?.length
        ? withFollowing(request)
        : { transactions: request.txs }
}
