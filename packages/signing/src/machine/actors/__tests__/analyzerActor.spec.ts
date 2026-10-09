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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createActor, toPromise } from 'xstate'
import {
    ChainAdapterNotRegisteredError,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    fakeReviewerAdapter,
    registerFakeReviewerAdapter,
} from '../../../__tests__/fakeReviewerAdapter'
import { reviewerChainAdapters } from '../../../chain-adapter'
import {
    GenesisHashMismatchError,
    ReviewRequiredError,
} from '../../../pipeline/errors'
import { analyzerActor } from '../analyzerActor'
import type { AnalyzerActorInput } from '../analyzerActor'
import type {
    AnalysisContext,
    DecodedGroup,
    SignableAnalysis,
    SignableGroup,
} from '../../../pipeline/types'

const FIXTURE_CHAIN_ID = 'fixturehex' as ChainId

const decoded = (totalFees: bigint): DecodedGroup => ({
    totalFees,
    transactionSummaries: [],
    signableAddresses: [],
})

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

const algorandContext: AnalysisContext = {
    scope: { chainId: 'algorand', networkId: 'mainnet' },
    accounts: [],
}

const buildInput = (
    groups: SignableGroup[],
    overrides: Partial<AnalyzerActorInput> = {},
): AnalyzerActorInput => ({
    groups,
    context: algorandContext,
    isHeadless: false,
    ...overrides,
})

const run = (input: AnalyzerActorInput) => {
    const actor = createActor(analyzerActor, { input })
    actor.start()
    return toPromise(actor)
}

describe('analyzerActor', () => {
    const decode = vi.fn()
    const detect = vi.fn()
    const autoApproveLocal = vi.fn()

    beforeEach(() => {
        decode.mockReset().mockResolvedValue(decoded(0n))
        detect.mockReset().mockReturnValue([])
        autoApproveLocal.mockReset().mockReturnValue(true)
        registerFakeReviewerAdapter({
            decoder: { decode },
            warnings: { detect },
            policy: { autoApproveLocal },
        })
    })

    it('returns one analysis per group, in order', async () => {
        decode
            .mockResolvedValueOnce(decoded(100n))
            .mockResolvedValueOnce(decoded(200n))

        const analyses = await run(buildInput([makeGroup('A'), makeGroup('B')]))

        expect(analyses.map(a => a.totalFees)).toEqual([100n, 200n])
    })

    it("warns from each group's decoded result, with the shared context", async () => {
        const groups = [makeGroup('A'), makeGroup('B')]
        decode
            .mockResolvedValueOnce(decoded(100n))
            .mockResolvedValueOnce(decoded(200n))

        await run(buildInput(groups))

        expect(detect).toHaveBeenNthCalledWith(
            1,
            groups[0],
            decoded(100n),
            algorandContext,
        )
        expect(detect).toHaveBeenNthCalledWith(
            2,
            groups[1],
            decoded(200n),
            algorandContext,
        )
    })

    it('rejects when the decoder throws', async () => {
        decode.mockRejectedValueOnce(new Error('decode blew up'))

        await expect(run(buildInput([makeGroup('A')]))).rejects.toThrow(
            'decode blew up',
        )
    })

    it('rejects with ChainAdapterNotRegisteredError when no reviewer adapter is registered', async () => {
        reviewerChainAdapters.reset()

        await expect(run(buildInput([makeGroup('A')]))).rejects.toBeInstanceOf(
            ChainAdapterNotRegisteredError,
        )
    })

    it("never falls back to another chain's reviewer", async () => {
        await expect(
            run(
                buildInput([makeGroup('A')], {
                    context: {
                        ...algorandContext,
                        scope: {
                            chainId: FIXTURE_CHAIN_ID,
                            networkId: 'mainnet',
                        },
                    },
                }),
            ),
        ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
        expect(decode).not.toHaveBeenCalled()
    })

    it("reviews another chain's request with that chain's reviewer, never Algorand's network check", async () => {
        decode.mockRejectedValue(
            new GenesisHashMismatchError('mainnet', 0, 'EXPECTED', 'ACTUAL'),
        )
        reviewerChainAdapters.register(
            fakeReviewerAdapter({
                chainId: FIXTURE_CHAIN_ID,
                decoder: { decode: async () => decoded(7n) },
            }),
        )

        const analyses = await run(
            buildInput([makeGroup('A')], {
                context: {
                    ...algorandContext,
                    scope: { chainId: FIXTURE_CHAIN_ID, networkId: 'mainnet' },
                },
            }),
        )

        expect(analyses.map(a => a.totalFees)).toEqual([7n])
        expect(decode).not.toHaveBeenCalled()
    })

    describe('with no review screen', () => {
        it("signs when the chain's policy approves every group", async () => {
            const analyses = await run(
                buildInput([makeGroup('A'), makeGroup('B')], {
                    isHeadless: true,
                }),
            )

            expect(analyses).toHaveLength(2)
            expect(autoApproveLocal).toHaveBeenCalledTimes(2)
        })

        it("refuses the request when the chain's policy turns down any group, naming that group's warnings", async () => {
            detect
                .mockReturnValueOnce([])
                .mockReturnValueOnce([
                    { type: 'rekey', severity: 'danger', message: 'rekey' },
                ])
            autoApproveLocal.mockImplementation(
                (analysis: SignableAnalysis) => analysis.warnings.length === 0,
            )

            const error = await run(
                buildInput([makeGroup('A'), makeGroup('B')], {
                    isHeadless: true,
                }),
            ).catch((e: unknown) => e)

            expect(error).toBeInstanceOf(ReviewRequiredError)
            expect((error as ReviewRequiredError).metadata.params).toEqual({
                warningTypes: ['rekey'],
            })
        })
    })

    it('leaves the decision to the user when a review screen shows the request', async () => {
        autoApproveLocal.mockReturnValue(false)

        const analyses = await run(buildInput([makeGroup('A')]))

        expect(analyses).toHaveLength(1)
        expect(autoApproveLocal).not.toHaveBeenCalled()
    })
})
