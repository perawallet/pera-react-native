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

import { describe, it, expect, vi } from 'vitest'
import { composeAnalysis, reviewGroup } from '../composeAnalysis'
import type {
    AnalysisContext,
    AnalysisWarning,
    DecodedGroup,
    SignableGroup,
} from '../types'

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

describe('reviewGroup', () => {
    it('hands the decoded group to the detector and composes both', async () => {
        const group = { signerAddress: 'A' } as SignableGroup
        const context = { accounts: [] } as unknown as AnalysisContext
        const detect = vi.fn(() => [warning('danger')])

        const analysis = await reviewGroup(
            { decoder: { decode: async () => decoded }, warnings: { detect } },
            group,
            context,
        )

        expect(detect).toHaveBeenCalledWith(group, decoded, context)
        expect(analysis).toEqual({
            ...decoded,
            warnings: [warning('danger')],
            riskLevel: 'high',
        })
    })
})
