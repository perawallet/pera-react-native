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
import type {
    SignableGroup,
    SignableAnalysis,
    AnalysisContext,
} from '../../pipeline/types'
import { reviewerChainAdapters } from '../../chain-adapter'
import { reviewGroup } from '../../pipeline/composeAnalysis'
import { ReviewRequiredError } from '../../pipeline/errors'

export type AnalyzerActorInput = {
    groups: SignableGroup[]
    context: AnalysisContext
    /** No review screen will show this request, so the chain's policy decides. */
    isHeadless: boolean
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
    const reviewer = reviewerChainAdapters.get(input.context.scope.chainId)
    const analyses = await Promise.all(
        input.groups.map(group => reviewGroup(reviewer, group, input.context)),
    )
    if (!input.isHeadless) return analyses
    const refused = analyses.filter(
        analysis => !reviewer.policy.autoApproveLocal(analysis),
    )
    if (refused.length > 0) {
        throw new ReviewRequiredError(
            refused.flatMap(analysis => analysis.warnings.map(w => w.type)),
        )
    }
    return analyses
})
