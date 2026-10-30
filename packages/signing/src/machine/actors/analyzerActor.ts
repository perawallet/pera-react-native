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

import { fromPromise } from 'xstate'
import {
    toScopeKey,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { getReviewApproval } from '../../db/repository'
import { REVIEW_APPROVAL_TTL_MS } from '../../db/types'
import type { ReviewApprovalRef } from '../../models'
import type {
    SignableGroup,
    SignableAnalysis,
    AnalysisContext,
} from '../../pipeline/types'
import { reviewGroup } from '../../pipeline/composeAnalysis'
import { ReviewRequiredError } from '../../pipeline/errors'
import {
    reviewerFor,
    type GroupReviewer,
} from '../../pipeline/transactionReviewerBridge'

export type AnalyzerActorInput = {
    groups: SignableGroup[]
    context: AnalysisContext
    /** No review screen will show this request, so the chain's policy decides. */
    isHeadless: boolean
    /** See `UnsignedTransactionSignRequest.reviewApproval`. */
    reviewApproval?: ReviewApprovalRef
}

// Each transaction must match what the approved review showed at the position
// the request names for it, so a review can't vouch for one it never showed.
const matchesApprovedReview = (
    reviewer: GroupReviewer,
    group: SignableGroup,
    positions: readonly number[],
    shown: readonly UnsignedTransaction[],
): boolean => {
    const { matchesApprovedPreview } = reviewer.policy
    if (!matchesApprovedPreview) return false
    if (group.data.type !== 'transactions') return false
    const { transactions } = group.data
    return (
        transactions.length > 0 &&
        transactions.every((transaction, index) => {
            const position = positions[group.originalIndices?.[index] ?? index]
            const preview = position === undefined ? undefined : shown[position]
            return (
                preview !== undefined &&
                matchesApprovedPreview(transaction, preview)
            )
        })
    )
}

// Read from the pipeline's own record, never from the request, and only for
// the network the request signs on and while the approval is fresh.
const approvedReviewOf = async (
    input: AnalyzerActorInput,
): Promise<Optional<UnsignedTransaction[]>> => {
    if (!input.reviewApproval) return undefined
    const approval = await getReviewApproval({
        token: input.reviewApproval.token,
    })
    return approval &&
        toScopeKey(approval.scope) === toScopeKey(input.context.scope) &&
        Date.now() - approval.createdAt <= REVIEW_APPROVAL_TTL_MS
        ? approval.transactions
        : undefined
}

/**
 * Reviews every group with the reviewer of the request's chain, one analysis
 * per group in the same order. A chain with no reviewer throws, so its
 * requests are refused rather than signed unreviewed.
 */
export const analyzerActor = fromPromise<
    SignableAnalysis[],
    AnalyzerActorInput
>(async ({ input }) => {
    // A message has no autoApproveLocal verdict: only a person reads it.
    if (input.isHeadless && input.groups.some(g => g.data.type === 'message')) {
        throw new ReviewRequiredError([])
    }
    const reviewer = reviewerFor(input.context.scope.chainId)
    const analyses = await Promise.all(
        input.groups.map(group => reviewGroup(reviewer, group, input.context)),
    )
    if (!input.isHeadless) return analyses
    const turnedDown = analyses
        .map((analysis, index) => ({ analysis, group: input.groups[index] }))
        .filter(({ analysis }) => !reviewer.policy.autoApproveLocal(analysis))
    const shown =
        turnedDown.length > 0 ? await approvedReviewOf(input) : undefined
    const refused = turnedDown
        .filter(
            ({ group }) =>
                !shown ||
                !input.reviewApproval ||
                !matchesApprovedReview(
                    reviewer,
                    group,
                    input.reviewApproval.positions,
                    shown,
                ),
        )
        .map(({ analysis }) => analysis)
    if (refused.length > 0) {
        throw new ReviewRequiredError(
            refused.flatMap(analysis => analysis.warnings.map(w => w.type)),
        )
    }
    return analyses
})
