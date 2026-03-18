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

import type {
    DataAnalyzer,
    SignableGroup,
    SignableAnalysis,
    AnalysisContext,
} from '../types'
import { EMPTY_SIGNABLE_ANALYSIS } from './constants'

/**
 * Creates an analyzer that chains multiple analyzers together.
 * Results are merged, with later analyzers taking precedence for overlapping data.
 */
export const createChainedAnalyzer = (
    ...analyzers: DataAnalyzer[]
): DataAnalyzer => {
    return {
        analyze: async (
            group: SignableGroup,
            context: AnalysisContext,
        ): Promise<SignableAnalysis> => {
            if (analyzers.length === 0) {
                return EMPTY_SIGNABLE_ANALYSIS
            }

            let result: SignableAnalysis | undefined

            for (const analyzer of analyzers) {
                const analysis = await analyzer.analyze(group, context)
                result = result ? mergeAnalysis(result, analysis) : analysis
            }

            return result!
        },
    }
}

/**
 * Merge two analysis results
 */
const mergeAnalysis = (
    base: SignableAnalysis,
    overlay: SignableAnalysis,
): SignableAnalysis => {
    // Merge warnings (combine)
    const mergedWarnings = [...base.warnings, ...overlay.warnings]

    // Merge signable addresses (union)
    const mergedSignableAddresses = Array.from(
        new Set([...base.signableAddresses, ...overlay.signableAddresses]),
    )

    // Take the higher risk level
    const riskLevel = getHigherRiskLevel(base.riskLevel, overlay.riskLevel)

    return {
        // Prefer overlay values for scalar fields
        totalFees: overlay.totalFees > 0n ? overlay.totalFees : base.totalFees,
        transactionSummaries:
            overlay.transactionSummaries.length > 0
                ? overlay.transactionSummaries
                : base.transactionSummaries,
        warnings: mergedWarnings,
        signableAddresses: mergedSignableAddresses,
        riskLevel,
    }
}

/**
 * Get the higher of two risk levels
 */
const getHigherRiskLevel = (
    a: 'low' | 'medium' | 'high',
    b: 'low' | 'medium' | 'high',
): 'low' | 'medium' | 'high' => {
    const levels = { low: 0, medium: 1, high: 2 }
    return levels[a] >= levels[b] ? a : b
}
