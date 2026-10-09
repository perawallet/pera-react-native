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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    CardChainAdapter,
    CardManualDepositBuildParams,
    DelegationApprovalParams,
} from '../chain-adapter'

export interface CardContractFixtures {
    scope: ChainScope
    /** A scope whose build carries no card deployment, when the chain has one. */
    unconfiguredScope?: ChainScope
    delegationApproval: DelegationApprovalParams
    balance: {
        address: string
        assetId: string
        /** Makes the chain report that the account holds nothing of the asset. */
        arrangeNoHolding(): void
    }
    deposit: {
        params: CardManualDepositBuildParams
        /** Makes the chain answer whatever building a transfer needs. */
        arrangeBuild(): void
    }
    eligibility: {
        account: WalletAccount
        /** An account the card contract can't draw from. */
        ineligibleAccount: WalletAccount
    }
    /** What the chain throws when an account can't cover its fee and minimum balance. */
    insufficientBalanceError: unknown
    /** Baanx's `network` label for a leg on this chain. */
    ownLegNetwork: string
    /** Baanx's `network` label for a leg on another chain. */
    foreignLegNetwork: string
}

/** Every chain package runs this against its own card adapter. */
export const cardContractTests = (
    makeAdapter: () => CardChainAdapter,
    fixtures: CardContractFixtures,
): void => {
    describe(`CardChainAdapter contract: ${makeAdapter().chainId}`, () => {
        it('builds the delegation approval deterministically, with a route and a body', () => {
            const adapter = makeAdapter()
            const build = () =>
                adapter.delegationApprovalRequest(fixtures.delegationApproval)

            const request = build()
            expect(build()).toEqual(request)
            expect(request.path).toMatch(/^\//)
            expect(request.data).toBeTypeOf('object')
        })

        it('names a settlement asset on a configured scope', () => {
            expect(makeAdapter().settlementAsset(fixtures.scope)).toBeTypeOf(
                'string',
            )
        })

        it.runIf(fixtures.unconfiguredScope !== undefined)(
            'has no settlement asset, and refuses a deposit, on a scope with no card deployment',
            async () => {
                const adapter = makeAdapter()
                const scope = fixtures.unconfiguredScope!

                expect(adapter.settlementAsset(scope)).toBeNull()
                await expect(
                    adapter.buildManualDeposit(fixtures.deposit.params, scope),
                ).rejects.toThrow(
                    expect.objectContaining({
                        name: 'CardEscrowNotConfiguredError',
                    }),
                )
            },
        )

        it('builds a manual deposit as a non-empty group', async () => {
            fixtures.deposit.arrangeBuild()

            const group = await makeAdapter().buildManualDeposit(
                fixtures.deposit.params,
                fixtures.scope,
            )

            expect(group.length).toBeGreaterThan(0)
        })

        it('reads an absent holding as zero', async () => {
            fixtures.balance.arrangeNoHolding()

            await expect(
                makeAdapter().getAssetBalance(
                    fixtures.scope,
                    fixtures.balance.address,
                    fixtures.balance.assetId,
                ),
            ).resolves.toBe(0n)
        })

        it('answers every funding-source question, refusing an account it cannot draw from', () => {
            const adapter = makeAdapter()
            const eligibility = adapter.fundingSourceEligibility(
                fixtures.eligibility.account,
                fixtures.scope,
            )

            expect(eligibility).toEqual({
                canFund: expect.any(Boolean),
                canProveOwnership: expect.any(Boolean),
                canAutoDraw: expect.any(Boolean),
            })
            expect(
                adapter.fundingSourceEligibility(
                    fixtures.eligibility.ineligibleAccount,
                    fixtures.scope,
                ).canFund,
            ).toBe(false)
        })

        it('names an insufficient-balance failure and nothing else', () => {
            const adapter = makeAdapter()

            expect(adapter.describeError(new Error('boom'))).toBeNull()
            expect(
                adapter.describeError(fixtures.insufficientBalanceError),
            ).toBe('insufficient-native-balance')
        })

        it('links only its own transaction legs', () => {
            const adapter = makeAdapter()

            expect(
                adapter.transactionUrl(
                    'HASH',
                    fixtures.foreignLegNetwork,
                    fixtures.scope,
                ),
            ).toBeNull()
            expect(
                adapter.transactionUrl(
                    'HASH',
                    fixtures.ownLegNetwork,
                    fixtures.scope,
                ),
            ).toEqual(expect.stringContaining('HASH'))
        })

        it('exposes auto-draw as a hook', () => {
            expect(makeAdapter().useAutoDraw).toBeTypeOf('function')
        })
    })
}
