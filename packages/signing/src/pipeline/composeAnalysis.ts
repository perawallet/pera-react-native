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

import type { AnalysisWarning, DecodedGroup, SignableAnalysis } from './types'

const riskLevelOf = (
    warnings: AnalysisWarning[],
): SignableAnalysis['riskLevel'] => {
    if (warnings.some(w => w.severity === 'danger')) return 'high'
    if (warnings.some(w => w.severity === 'warning')) return 'medium'
    return 'low'
}

/** The risk level is the worst warning's severity, the same on every chain. */
export const composeAnalysis = (
    decoded: DecodedGroup,
    warnings: AnalysisWarning[],
): SignableAnalysis => ({
    ...decoded,
    warnings,
    riskLevel: riskLevelOf(warnings),
})
