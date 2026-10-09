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

import { describe, expect, it } from 'vitest'
import type { ReviewerChainAdapter } from '../chain-adapter'
import { reviewGroup } from '../pipeline/composeAnalysis'
import type { AnalysisContext, SignableGroup } from '../pipeline/types'

export interface ReviewerContractFixtures {
    /** Its scope is on the adapter's chain, and its accounts sign the groups below. */
    context: AnalysisContext
    /** Transactions a wallet account signs that hold nothing to warn about. */
    plainGroup: SignableGroup
    /** Transactions a wallet account signs that the chain must warn about. */
    riskyGroup: SignableGroup
    /** What `riskyGroup` holds, signed by an account outside the wallet. */
    foreignGroup: SignableGroup
    /** A contract call a wallet account signs whose effect the chain can't read. */
    opaqueGroup: SignableGroup
    /** Whether the chain lets `opaqueGroup` sign without review when the app built it. */
    opaqueAutoApproves: boolean
    /** A transaction a wallet account signs, built for another network. */
    wrongNetworkGroup: SignableGroup
    /** Arbitrary data for a wallet account to sign. */
    messageGroup: SignableGroup
}

const transactionsOf = (group: SignableGroup) =>
    group.data.type === 'transactions' ? group.data.transactions : []

/** Every chain package runs this against its own reviewer adapter. */
export const reviewerContractTests = (
    makeAdapter: () => ReviewerChainAdapter,
    fixtures: ReviewerContractFixtures,
): void => {
    const { context } = fixtures
    const decode = (group: SignableGroup) =>
        makeAdapter().decoder.decode(group, context)
    const detect = async (group: SignableGroup) =>
        makeAdapter().warnings.detect(group, await decode(group), context)
    const analyse = (group: SignableGroup) =>
        reviewGroup(makeAdapter(), group, context)

    describe(`ReviewerChainAdapter contract: ${makeAdapter().chainId}`, () => {
        it("reviews its own chain's groups", () => {
            expect(makeAdapter().chainId).toBe(context.scope.chainId)
        })

        it('explains every transaction of a group a wallet account signs', async () => {
            const decoded = await decode(fixtures.plainGroup)

            expect(transactionsOf(fixtures.plainGroup).length).toBeGreaterThan(
                0,
            )
            expect(decoded.transactionSummaries).toHaveLength(
                transactionsOf(fixtures.plainGroup).length,
            )
            expect(decoded.signableAddresses).toEqual([
                fixtures.plainGroup.signerAddress,
            ])
        })

        it('neither charges nor warns for a group no wallet account signs', async () => {
            const decoded = await decode(fixtures.foreignGroup)

            expect(decoded.totalFees).toBe(0n)
            expect(decoded.signableAddresses).toEqual([])
            expect(await detect(fixtures.foreignGroup)).toEqual([])
        })

        // What a chain reads off the call itself (an EVM `to` and `value`) may
        // show, so the effect it can't read is pinned by each chain's own spec.
        it("still explains a contract call it can't read", async () => {
            const decoded = await decode(fixtures.opaqueGroup)

            expect(decoded.transactionSummaries).toHaveLength(
                transactionsOf(fixtures.opaqueGroup).length,
            )
        })

        it('refuses a transaction built for another network', async () => {
            await expect(decode(fixtures.wrongNetworkGroup)).rejects.toThrow()
        })

        it('decodes message data to no transactions and no fees', async () => {
            const decoded = await decode(fixtures.messageGroup)

            expect(decoded.transactionSummaries).toEqual([])
            expect(decoded.totalFees).toBe(0n)
        })

        it('finds nothing to warn about in a plain group', async () => {
            expect(await detect(fixtures.plainGroup)).toEqual([])
        })

        it('warns about a risky group and raises its risk above low', async () => {
            const analysis = await analyse(fixtures.riskyGroup)

            expect(analysis.warnings.length).toBeGreaterThan(0)
            expect(analysis.riskLevel).not.toBe('low')
        })

        it('lets a plain request the app built sign without review', async () => {
            expect(
                makeAdapter().policy.autoApproveLocal(
                    await analyse(fixtures.plainGroup),
                ),
            ).toBe(true)
        })

        it("decides for the app's own contract call as the chain declares", async () => {
            expect(
                makeAdapter().policy.autoApproveLocal(
                    await analyse(fixtures.opaqueGroup),
                ),
            ).toBe(fixtures.opaqueAutoApproves)
        })
    })
}
