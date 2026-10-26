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
import {
    FEE_PRESETS,
    type AssetOptInIntent,
    type BuildContext,
    type ChainId,
    type TransferIntent,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    SpendableBalanceInput,
    TransferChainAdapter,
} from '../transfer-adapter'

export interface TransferContractFixtures {
    /** On the adapter's chain. */
    context: BuildContext
    /** Moves the chain's native asset between two different addresses. */
    nativeTransfer: TransferIntent
    /** Set when the chain has tokens. */
    tokenTransfer?: TransferIntent
    /** Set if and only if the chain requires an opt-in before holding an asset. */
    assetOptIn?: AssetOptInIntent
    spendable: {
        /** Holds `nativeBalance` of the native asset once `arrange()` has run. */
        account: WalletAccount
        /** Base units of the native asset. */
        nativeBalance: Decimal
        /** Base units of the native asset. */
        fee: Decimal
        /** False on a chain that holds nothing back, where MAX is exactly the balance less the fee. */
        hasReserve: boolean
    }
    /** The chain descriptor's `protocol.supportsReplacement`. */
    supportsReplacement: boolean
    /** Installs the node handlers and synced state each test needs. */
    arrange(): void
}

/** Every chain package runs this against its own transfer adapter. */
export const transferContractTests = (
    makeAdapter: () => TransferChainAdapter,
    fixtures: TransferContractFixtures,
): void => {
    const { context, nativeTransfer, spendable } = fixtures
    const spendableInput: SpendableBalanceInput = {
        account: spendable.account,
        asset: nativeTransfer.assetRef,
        scope: context.scope,
        fee: spendable.fee,
    }
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
        return built.map(
            (transaction: UnsignedTransaction) => transaction.summary,
        )
    }

    describe(`TransferChainAdapter contract: ${makeAdapter().chainId}`, () => {
        beforeEach(() => {
            fixtures.arrange()
        })

        it('re-prices pending transactions exactly when its chain supports replacement', () => {
            expect(typeof makeAdapter().buildReplacement === 'function').toBe(
                fixtures.supportsReplacement,
            )
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
            expect(transfer?.amount?.value.equals(nativeTransfer.amount)).toBe(
                true,
            )
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
            const { presets } = estimate
            if (presets) {
                expect(estimate.amount.equals(presets.normal.amount)).toBe(true)
                expect(presets.slow.amount.lte(presets.normal.amount)).toBe(
                    true,
                )
                expect(presets.normal.amount.lte(presets.fast.amount)).toBe(
                    true,
                )
                for (const preset of FEE_PRESETS) {
                    const { amount, maxAmount } = presets[preset]
                    expect(amount.isInteger() && maxAmount.isInteger()).toBe(
                        true,
                    )
                    expect(amount.gt(0)).toBe(true)
                    expect(maxAmount.gte(amount)).toBe(true)
                }
            }
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

        it('never offers more of the native asset than the balance less the fee', async () => {
            const result = await makeAdapter().spendableBalance(spendableInput)

            expect(result.balance.equals(spendable.nativeBalance)).toBe(true)
            expect(result.max.isInteger()).toBe(true)
            expect(result.max.gte(0)).toBe(true)
            expect(
                result.max.lte(spendable.nativeBalance.sub(spendable.fee)),
            ).toBe(true)
            expect(result.reserved.gte(0)).toBe(true)
        })

        it('never offers more of the native asset while an earlier send is in flight', async () => {
            const adapter = makeAdapter()
            const idle = await adapter.spendableBalance(spendableInput)

            const result = await adapter.spendableBalance({
                ...spendableInput,
                inFlight: [
                    {
                        // Past any synced sequence number, so it reads as unmined.
                        nonce: Number.MAX_SAFE_INTEGER,
                        outflows: [
                            {
                                assetRef: spendableInput.asset,
                                value: spendable.nativeBalance,
                            },
                        ],
                        maxFee: spendable.fee,
                    },
                ],
            })

            expect(result.max.gte(0)).toBe(true)
            expect(result.max.lte(idle.max)).toBe(true)
            expect(result.reserved.gte(idle.reserved)).toBe(true)
        })

        it("refuses to price another chain's scope", async () => {
            await expect(
                makeAdapter().spendableBalance({
                    ...spendableInput,
                    scope: foreignContext.scope,
                }),
            ).rejects.toThrow()
        })

        if (!spendable.hasReserve) {
            it('holds nothing back: MAX is the balance less the fee, with no close-out', async () => {
                const result =
                    await makeAdapter().spendableBalance(spendableInput)

                expect(
                    result.max.equals(
                        spendable.nativeBalance.sub(spendable.fee),
                    ),
                ).toBe(true)
                expect(result.reserved.isZero()).toBe(true)
                expect(result.reserveNotice).toBeUndefined()
                expect(result.emptyAccount).toBeUndefined()
                expect(
                    makeAdapter().holdingReserve?.(context.scope),
                ).toBeUndefined()
            })

            it('has no recipient rule', async () => {
                const warning = await makeAdapter().recipientWarning?.({
                    recipient: nativeTransfer.to,
                    asset: nativeTransfer.assetRef,
                    amount: nativeTransfer.amount,
                    scope: context.scope,
                })

                expect(warning).toBeUndefined()
            })
        }

        if (makeAdapter().addressPoisoning) {
            it('screens recipients with a positive whole look-alike threshold and a non-negative dust ceiling', () => {
                const rules = makeAdapter().addressPoisoning?.()

                expect(Number.isInteger(rules?.lookalikeMatchedChars)).toBe(
                    true,
                )
                expect(rules?.lookalikeMatchedChars).toBeGreaterThan(0)
                expect(rules?.dustCeiling.isNegative()).toBe(false)
            })
        }

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
