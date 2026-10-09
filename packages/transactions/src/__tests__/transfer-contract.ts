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

import { beforeEach, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import type {
    AssetOptInIntent,
    BuildContext,
    ChainId,
    TransferIntent,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { TransferChainAdapter } from '../transfer-adapter'

export interface TransferContractFixtures {
    /** On the adapter's chain. */
    context: BuildContext
    /** Moves the chain's native asset between two different addresses. */
    nativeTransfer: TransferIntent
    /** Set when the chain has tokens. */
    tokenTransfer?: TransferIntent
    /** Set if and only if the chain requires an opt-in before holding an asset. */
    assetOptIn?: AssetOptInIntent
    /** Installs the node handlers each test needs. */
    arrange(): void
}

/** Every chain package runs this against its own transfer adapter. */
export const transferContractTests = (
    makeAdapter: () => TransferChainAdapter,
    fixtures: TransferContractFixtures,
): void => {
    const { context, nativeTransfer } = fixtures
    const foreignContext: BuildContext = {
        ...context,
        scope: {
            ...context.scope,
            chainId: 'not-this-chain' as ChainId,
        },
    }

    const summaryOf = async (intent: TransferIntent | AssetOptInIntent) => {
        const built = await makeAdapter().build(intent, context)
        expect(built.length).toBeGreaterThan(0)
        return built.map((transaction: UnsignedTransaction) => transaction.summary)
    }

    describe(`TransferChainAdapter contract: ${makeAdapter().chainId}`, () => {
        beforeEach(() => {
            fixtures.arrange()
        })

        it("builds for its own chain's scopes", () => {
            expect(makeAdapter().chainId).toBe(context.scope.chainId)
        })

        it('builds a native transfer for the context scope, summarised as an outgoing transfer', async () => {
            const built = await makeAdapter().build(nativeTransfer, context)

            expect(built.length).toBeGreaterThan(0)
            for (const transaction of built) {
                expect(transaction.scope).toEqual(context.scope)
            }
            const transfer = built
                .map(transaction => transaction.summary)
                .find(summary => summary.kind === 'transfer')
            expect(transfer).toMatchObject({
                direction: 'out',
                counterparty: nativeTransfer.to,
                amount: { assetRef: nativeTransfer.assetRef },
            })
            expect(
                transfer?.amount?.value.equals(nativeTransfer.amount),
            ).toBe(true)
        })

        if (fixtures.tokenTransfer) {
            const tokenTransfer = fixtures.tokenTransfer

            it('summarises a token transfer with the token it moves', async () => {
                const summaries = await summaryOf(tokenTransfer)

                expect(summaries).toContainEqual(
                    expect.objectContaining({
                        kind: 'token-transfer',
                        amount: expect.objectContaining({
                            assetRef: tokenTransfer.assetRef,
                        }),
                    }),
                )
            })
        }

        if (fixtures.assetOptIn) {
            const assetOptIn = fixtures.assetOptIn

            it('builds an asset opt-in that moves nothing', async () => {
                const summaries = await summaryOf(assetOptIn)

                expect(summaries).toContainEqual(
                    expect.objectContaining({
                        icon: 'opt-in',
                        direction: 'none',
                    }),
                )
            })
        } else {
            // Matched by shape, not class: a chain package may load the error
            // from transactions' build while this suite loads it from source.
            it('refuses an asset opt-in it has no use for', async () => {
                await expect(
                    makeAdapter().build(
                        {
                            kind: 'asset-opt-in',
                            account: nativeTransfer.from,
                            assetRef: nativeTransfer.assetRef,
                        },
                        context,
                    ),
                ).rejects.toMatchObject({
                    name: 'UnsupportedTransactionIntentError',
                })
            })
        }

        it('estimates the fee as a whole, positive amount of the native asset', async () => {
            const estimate = await makeAdapter().getFeeEstimate(
                nativeTransfer,
                context,
            )

            expect(estimate.assetRef).toEqual(nativeTransfer.assetRef)
            expect(estimate.amount.gt(0)).toBe(true)
            expect(estimate.amount.isInteger()).toBe(true)
        })

        it("refuses another chain's scope", async () => {
            await expect(
                makeAdapter().build(nativeTransfer, foreignContext),
            ).rejects.toThrow()
            await expect(
                makeAdapter().getFeeEstimate(nativeTransfer, foreignContext),
            ).rejects.toThrow()
        })

        it('refuses an asset from another chain', async () => {
            await expect(
                makeAdapter().build(
                    {
                        ...nativeTransfer,
                        assetRef: {
                            ...nativeTransfer.assetRef,
                            chainId: 'not-this-chain' as ChainId,
                        },
                    },
                    context,
                ),
            ).rejects.toThrow()
        })

        it.each([new Decimal(-1), new Decimal('0.5')])(
            'refuses %s base units rather than rounding it',
            async amount => {
                await expect(
                    makeAdapter().build({ ...nativeTransfer, amount }, context),
                ).rejects.toThrow()
            },
        )
    })
}
