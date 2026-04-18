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

import { describe, test, expect } from 'vitest'
import { createChainedAnalyzer } from '../createChainedAnalyzer'
import { createNoOpAnalyzer } from '../createNoOpAnalyzer'
import type {
    AnalysisContext,
    DataAnalyzer,
    SignableAnalysis,
    SignableGroup,
} from '../../types'

const context = { network: 'mainnet', accounts: [] } as AnalysisContext
const group = {
    data: { type: 'arbitrary-data', data: [] },
    source: { type: 'local' },
    signerAddress: 'ADDR',
} as SignableGroup

const fakeAnalyzer = (analysis: SignableAnalysis): DataAnalyzer => ({
    analyze: async () => analysis,
})

describe('createChainedAnalyzer', () => {
    test('returns empty analysis when no analyzers passed', async () => {
        const analyzer = createChainedAnalyzer()
        const result = await analyzer.analyze(group, context)

        expect(result.totalFees).toBe(0n)
        expect(result.warnings).toEqual([])
        expect(result.riskLevel).toBe('low')
    })

    test('returns single analyzer result unchanged', async () => {
        const single: SignableAnalysis = {
            totalFees: 100n,
            transactionSummaries: [],
            warnings: [],
            signableAddresses: ['ADDR_A'],
            riskLevel: 'medium',
        }
        const analyzer = createChainedAnalyzer(fakeAnalyzer(single))

        const result = await analyzer.analyze(group, context)
        expect(result).toEqual(single)
    })

    test('merges warnings from both analyzers', async () => {
        const first: SignableAnalysis = {
            totalFees: 0n,
            transactionSummaries: [],
            warnings: [
                { type: 'high-fee', severity: 'warning', message: 'fee' },
            ],
            signableAddresses: [],
            riskLevel: 'medium',
        }
        const second: SignableAnalysis = {
            totalFees: 0n,
            transactionSummaries: [],
            warnings: [{ type: 'rekey', severity: 'danger', message: 'rekey' }],
            signableAddresses: [],
            riskLevel: 'high',
        }
        const analyzer = createChainedAnalyzer(
            fakeAnalyzer(first),
            fakeAnalyzer(second),
        )
        const result = await analyzer.analyze(group, context)

        expect(result.warnings).toHaveLength(2)
        expect(result.riskLevel).toBe('high')
    })

    test('overlay totalFees wins when greater than 0', async () => {
        const first: SignableAnalysis = {
            totalFees: 100n,
            transactionSummaries: [{ type: 'pay', sender: 'A' } as never],
            warnings: [],
            signableAddresses: ['A'],
            riskLevel: 'low',
        }
        const second: SignableAnalysis = {
            totalFees: 500n,
            transactionSummaries: [{ type: 'pay', sender: 'B' } as never],
            warnings: [],
            signableAddresses: ['B'],
            riskLevel: 'low',
        }
        const analyzer = createChainedAnalyzer(
            fakeAnalyzer(first),
            fakeAnalyzer(second),
        )
        const result = await analyzer.analyze(group, context)

        expect(result.totalFees).toBe(500n)
        expect(result.transactionSummaries).toEqual([
            { type: 'pay', sender: 'B' },
        ])
        expect(result.signableAddresses.sort()).toEqual(['A', 'B'])
    })

    test('keeps base values when overlay has zero fees / empty summaries', async () => {
        const first: SignableAnalysis = {
            totalFees: 100n,
            transactionSummaries: [{ type: 'pay', sender: 'A' } as never],
            warnings: [],
            signableAddresses: ['A'],
            riskLevel: 'low',
        }
        const second: SignableAnalysis = {
            totalFees: 0n,
            transactionSummaries: [],
            warnings: [],
            signableAddresses: [],
            riskLevel: 'low',
        }
        const analyzer = createChainedAnalyzer(
            fakeAnalyzer(first),
            fakeAnalyzer(second),
        )
        const result = await analyzer.analyze(group, context)

        expect(result.totalFees).toBe(100n)
        expect(result.transactionSummaries).toEqual([
            { type: 'pay', sender: 'A' },
        ])
    })
})

describe('createNoOpAnalyzer', () => {
    test('always returns empty analysis', async () => {
        const analyzer = createNoOpAnalyzer()
        const result = await analyzer.analyze(group, context)
        expect(result.totalFees).toBe(0n)
        expect(result.warnings).toEqual([])
        expect(result.riskLevel).toBe('low')
    })
})
