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

import { describe, it, expect } from 'vitest'
import { composeAnalysis } from '../composeAnalysis'
import type { AnalysisWarning, DecodedGroup } from '../types'

const decoded: DecodedGroup = {
    totalFees: 2000n,
    transactionSummaries: [{ type: 'payment', sender: 'A' }],
    signableAddresses: ['A'],
}

const warning = (severity: AnalysisWarning['severity']): AnalysisWarning => ({
    type: 'rekey',
    severity,
    message: severity,
})

describe('composeAnalysis', () => {
    it('keeps the decoded group and its warnings as they are', () => {
        const warnings = [warning('info')]

        expect(composeAnalysis(decoded, warnings)).toEqual({
            ...decoded,
            warnings,
            riskLevel: 'low',
        })
    })

    it.each([
        [[], 'low'],
        [[warning('info')], 'low'],
        [[warning('info'), warning('warning')], 'medium'],
        [[warning('warning'), warning('danger')], 'high'],
    ] as const)(
        'rates %j as %s, by the worst severity',
        (warnings, riskLevel) => {
            expect(composeAnalysis(decoded, [...warnings]).riskLevel).toBe(
                riskLevel,
            )
        },
    )
})
