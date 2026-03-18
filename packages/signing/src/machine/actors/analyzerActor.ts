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

import { fromPromise } from 'xstate'
import type {
    SignableGroup,
    SignableAnalysis,
    AnalysisContext,
} from '../../pipeline/types'
import { createStandardAnalyzer } from '../../pipeline/analyzers/createStandardAnalyzer'

export type AnalyzerActorInput = {
    groups: SignableGroup[]
    context: AnalysisContext
}

/**
 * XState actor that analyzes all signable groups in a request.
 * Returns one SignableAnalysis per group, in the same order.
 */
export const analyzerActor = fromPromise<
    SignableAnalysis[],
    AnalyzerActorInput
>(async ({ input }) => {
    const analyzer = createStandardAnalyzer()
    return Promise.all(
        input.groups.map(group => analyzer.analyze(group, input.context)),
    )
})
