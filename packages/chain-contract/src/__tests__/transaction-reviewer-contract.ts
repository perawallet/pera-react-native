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
import type {
    ReviewContext,
    TransactionReview,
    TransactionReviewer,
} from '../contracts/transaction-reviewer'
import type { UnsignedTransaction } from '../models/domain'
import { i18nKey } from '../models/i18n'
import type { ChainId } from '../models/identity'

export interface TransactionReviewerContractFixtures {
    /** On the reviewer's chain, not built by the app, every capability off. */
    context: ReviewContext
    /** The held address that signs every group below but `foreignGroup`. */
    signer: string
    /** Two or more transactions that hold nothing to warn about, each reviewed differently. */
    plainGroup: UnsignedTransaction[]
    /** Transactions the chain must warn about. */
    riskyGroup: UnsignedTransaction[]
    /** What `riskyGroup` holds, signed by an address the wallet doesn't hold. */
    foreignGroup: UnsignedTransaction[]
    /** A contract call whose effect the chain can't read. */
    opaqueGroup: UnsignedTransaction[]
    /** Whether the chain lets `opaqueGroup` sign without review when the app built it. */
    opaqueAutoApproves: boolean
    /** A transaction built for another network than `context.scope`. */
    wrongNetworkGroup: UnsignedTransaction[]
}

const UNRECOGNISED_KINDS = ['contract-call', 'chain-specific']

/** Every chain package runs this against its own transaction reviewer. */
export const transactionReviewerContractTests = (
    makeReviewer: () => TransactionReviewer,
    fixtures: TransactionReviewerContractFixtures,
): void => {
    const { context } = fixtures

    const decode = (
        transactions: UnsignedTransaction[],
        reviewContext: ReviewContext = context,
    ) => makeReviewer().decoder.decode(transactions, reviewContext)

    const review = async (
        transactions: UnsignedTransaction[],
        reviewContext: ReviewContext = context,
    ): Promise<TransactionReview> => {
        const reviewer = makeReviewer()
        const decoded = await reviewer.decoder.decode(
            transactions,
            reviewContext,
        )
        return {
            ...decoded,
            warnings: reviewer.warnings.detect(
                transactions,
                decoded,
                reviewContext,
            ),
        }
    }

    const kindsOf = (decoded: {
        transactions: TransactionReview['transactions']
    }) => decoded.transactions.map(t => t.summary.kind)

    describe(`transaction reviewer contract: ${makeReviewer().chainId}`, () => {
        it("reviews its own chain's transactions", () => {
            expect(makeReviewer().chainId).toBe(context.scope.chainId)
        })

        it('explains every transaction, in order', async () => {
            const [decoded, reversed] = await Promise.all([
                decode(fixtures.plainGroup),
                decode([...fixtures.plainGroup].reverse()),
            ])

            expect(fixtures.plainGroup.length).toBeGreaterThan(1)
            expect(decoded.transactions).toHaveLength(
                fixtures.plainGroup.length,
            )
            // Reversal proves order only if the reviews tell the inputs apart.
            expect(decoded.transactions[0]).not.toEqual(decoded.transactions[1])
            expect(reversed.transactions).toEqual(
                [...decoded.transactions].reverse(),
            )
            expect(decoded.transactions.filter(t => !t.native.family)).toEqual(
                [],
            )
        })

        it('lists the held address that signs', async () => {
            const decoded = await decode(fixtures.plainGroup)

            expect(decoded.signableAddresses).toEqual([fixtures.signer])
        })

        it('neither charges nor warns for transactions no held address signs', async () => {
            const reviewed = await review(fixtures.foreignGroup)

            expect(reviewed.totalFees.isZero()).toBe(true)
            expect(reviewed.signableAddresses).toEqual([])
            expect(reviewed.warnings).toEqual([])
        })

        it("leaves a contract call it can't read unrecognised", async () => {
            const decoded = await decode(fixtures.opaqueGroup)

            expect(decoded.transactions).toHaveLength(
                fixtures.opaqueGroup.length,
            )
            expect(
                kindsOf(decoded).filter(
                    kind => !UNRECOGNISED_KINDS.includes(kind),
                ),
            ).toEqual([])
        })

        it("refuses another chain's transaction", async () => {
            const otherChain: ChainId =
                makeReviewer().chainId === 'algorand' ? 'ethereum' : 'algorand'
            const [first, ...rest] = fixtures.plainGroup

            await expect(
                decode([
                    {
                        ...first,
                        scope: { ...first.scope, chainId: otherChain },
                    },
                    ...rest,
                ]),
            ).rejects.toThrow()
        })

        it('refuses a transaction built for another network', async () => {
            await expect(decode(fixtures.wrongNetworkGroup)).rejects.toThrow()
        })

        it('finds nothing to warn about in a plain group, and lets the app sign it without review', async () => {
            const reviewed = await review(fixtures.plainGroup)

            expect(reviewed.warnings).toEqual([])
            expect(makeReviewer().policy.autoApproveLocal(reviewed)).toBe(true)
        })

        it('warns about a risky group', async () => {
            const reviewed = await review(fixtures.riskyGroup)

            expect(reviewed.warnings.length).toBeGreaterThan(0)
        })

        it("decides for the app's own contract call as the chain declares", async () => {
            const reviewed = await review(fixtures.opaqueGroup, {
                ...context,
                isWalletBuilt: true,
            })

            expect(makeReviewer().policy.autoApproveLocal(reviewed)).toBe(
                fixtures.opaqueAutoApproves,
            )
        })

        it("ignores the summary a request it didn't build supplies", async () => {
            const claimed = fixtures.opaqueGroup.map(transaction => ({
                ...transaction,
                summary: {
                    kind: 'transfer' as const,
                    title: { key: i18nKey('claimed') },
                    direction: 'out' as const,
                    counterparty: fixtures.signer,
                    icon: 'send' as const,
                },
            }))

            const [honest, forged] = await Promise.all([
                decode(fixtures.opaqueGroup),
                decode(claimed),
            ])

            expect(kindsOf(forged)).toEqual(kindsOf(honest))
            expect(
                forged.transactions.filter(
                    t => t.summary.title.key === 'claimed',
                ),
            ).toEqual([])
        })
    })
}
