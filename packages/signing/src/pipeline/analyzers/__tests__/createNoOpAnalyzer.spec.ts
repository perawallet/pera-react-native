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

import { describe, it, expect } from 'vitest'
import { createNoOpAnalyzer } from '../createNoOpAnalyzer'
import { EMPTY_SIGNABLE_ANALYSIS } from '../constants'
import type { AnalysisContext, SignableGroup } from '../../types'

const makeGroup = (): SignableGroup =>
    ({
        data: {
            type: 'transactions',
            transactions: [{ sender: { toString: () => 'A' } } as never],
            indicesToSign: [0],
        },
        source: { type: 'local' },
        signerAddress: 'A',
    }) as SignableGroup

const makeContext = (): AnalysisContext =>
    ({
        network: 'mainnet',
        accounts: [{ address: 'A' } as never],
    }) as AnalysisContext

describe('createNoOpAnalyzer', () => {
    it('returns the empty signable analysis contract (no fees, no warnings, low risk)', async () => {
        const analyzer = createNoOpAnalyzer()
        const result = await analyzer.analyze(makeGroup(), makeContext())

        expect(result).toBe(EMPTY_SIGNABLE_ANALYSIS)
        expect(result.totalFees).toBe(0n)
        expect(result.transactionSummaries).toEqual([])
        expect(result.warnings).toEqual([])
        expect(result.signableAddresses).toEqual([])
        expect(result.riskLevel).toBe('low')
    })

    it('returns the same empty analysis regardless of input', async () => {
        const analyzer = createNoOpAnalyzer()
        const first = await analyzer.analyze(makeGroup(), makeContext())
        const second = await analyzer.analyze(
            {
                data: { type: 'arbitrary-data', data: [] },
                source: { type: 'walletconnect' },
                signerAddress: 'B',
            } as SignableGroup,
            makeContext(),
        )

        expect(first).toBe(second)
    })
})
