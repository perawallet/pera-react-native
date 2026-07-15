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
import { createActor, toPromise } from 'xstate'

const mocks = vi.hoisted(() => ({
    analyze: vi.fn(),
}))

vi.mock('../../../pipeline/analyzers/createStandardAnalyzer', () => ({
    createStandardAnalyzer: () => ({ analyze: mocks.analyze }),
}))

import { analyzerActor } from '../analyzerActor'
import type { AnalyzerActorInput } from '../analyzerActor'
import type {
    AnalysisContext,
    SignableAnalysis,
    SignableGroup,
} from '../../../pipeline/types'

const emptyAnalysis: SignableAnalysis = {
    totalFees: 0n,
    transactionSummaries: [],
    warnings: [],
    signableAddresses: [],
    riskLevel: 'low',
}

const makeGroup = (signerAddress: string): SignableGroup =>
    ({
        data: {
            type: 'transactions',
            transactions: [],
            indicesToSign: [],
        },
        source: { type: 'local' },
        signerAddress,
    }) as SignableGroup

const makeContext = (): AnalysisContext =>
    ({
        network: 'mainnet',
        accounts: [],
    }) as AnalysisContext

const buildInput = (groups: SignableGroup[]): AnalyzerActorInput => ({
    groups,
    context: makeContext(),
})

describe('analyzerActor', () => {
    it('returns one analysis per group, in order', async () => {
        mocks.analyze
            .mockResolvedValueOnce({ ...emptyAnalysis, totalFees: 100n })
            .mockResolvedValueOnce({ ...emptyAnalysis, totalFees: 200n })

        const input = buildInput([makeGroup('A'), makeGroup('B')])
        const actor = createActor(analyzerActor, { input })
        actor.start()
        const results = await toPromise(actor)

        expect(results).toHaveLength(2)
        expect(results[0].totalFees).toBe(100n)
        expect(results[1].totalFees).toBe(200n)
        expect(mocks.analyze).toHaveBeenCalledTimes(2)
    })

    it('passes the same analysis context to each group invocation', async () => {
        mocks.analyze.mockResolvedValue(emptyAnalysis)

        const groups = [makeGroup('A'), makeGroup('B')]
        const input = buildInput(groups)
        const actor = createActor(analyzerActor, { input })
        actor.start()
        await toPromise(actor)

        expect(mocks.analyze).toHaveBeenNthCalledWith(
            1,
            groups[0],
            input.context,
        )
        expect(mocks.analyze).toHaveBeenNthCalledWith(
            2,
            groups[1],
            input.context,
        )
    })

    it('rejects when the underlying analyzer throws', async () => {
        mocks.analyze.mockRejectedValueOnce(new Error('analysis blew up'))

        const input = buildInput([makeGroup('A')])
        const actor = createActor(analyzerActor, { input })
        actor.start()

        await expect(toPromise(actor)).rejects.toThrow('analysis blew up')
    })
})
