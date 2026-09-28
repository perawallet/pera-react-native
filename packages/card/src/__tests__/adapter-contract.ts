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
import type { Network } from '@perawallet/wallet-core-shared'
import type {
    AutoDrawToggleParams,
    CardChainAdapter,
    DelegationApprovalParams,
    DelegatorProgramParams,
} from '../chain-adapter'

export interface CardContractFixtures {
    network: Network
    /** A network whose build carries no card ids, when the chain has one. */
    unconfiguredNetwork?: Network
    delegationApproval: DelegationApprovalParams
    delegatorProgram: DelegatorProgramParams
    balance: {
        address: string
        assetId: string
        /** Makes the chain report that the account holds nothing of the asset. */
        arrangeNoHolding(): void
    }
    autoDraw: {
        params: AutoDrawToggleParams
        /** Makes the switch's state read fail for a reason other than "absent". */
        arrangeUnknownState(): void
    }
}

/** Every chain package runs this against its own card adapter. */
export const cardContractTests = (
    makeAdapter: () => CardChainAdapter,
    fixtures: CardContractFixtures,
): void => {
    describe(`CardChainAdapter contract: ${makeAdapter().chainId}`, () => {
        it('builds delegation requests deterministically, with a route and a body', () => {
            const adapter = makeAdapter()
            const requests = [
                () =>
                    adapter.delegationApprovalRequest(
                        fixtures.delegationApproval,
                    ),
                () =>
                    adapter.delegatorProgramRequest(fixtures.delegatorProgram),
            ]

            for (const build of requests) {
                const request = build()
                expect(build()).toEqual(request)
                expect(request.path).toMatch(/^\//)
                expect(request.data).toBeTypeOf('object')
            }
        })

        it.runIf(fixtures.unconfiguredNetwork !== undefined)(
            'refuses a network with no card ids',
            () => {
                expect(() =>
                    makeAdapter().resolveEscrowChainConfig(
                        fixtures.unconfiguredNetwork!,
                    ),
                ).toThrow(
                    expect.objectContaining({
                        name: 'CardEscrowNotConfiguredError',
                    }),
                )
            },
        )

        it('reads an absent holding as zero', async () => {
            fixtures.balance.arrangeNoHolding()

            await expect(
                makeAdapter().getAssetBalance(
                    fixtures.network,
                    fixtures.balance.address,
                    fixtures.balance.assetId,
                ),
            ).resolves.toBe(0n)
        })

        it('answers whether auto-draw is configured', () => {
            expect(
                makeAdapter().autoDraw.isConfigured(fixtures.network),
            ).toBeTypeOf('boolean')
        })

        it('rethrows an unknown auto-draw state instead of reading it as disabled', async () => {
            fixtures.autoDraw.arrangeUnknownState()

            await expect(
                makeAdapter().autoDraw.isEnabled(fixtures.autoDraw.params),
            ).rejects.toBeDefined()
        })
    })
}
