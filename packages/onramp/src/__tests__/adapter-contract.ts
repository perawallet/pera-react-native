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
import type { RampChainAdapter } from '../chain-adapter'

export type RampContractAsset = {
    /** CAIP-19. */
    routerAssetId: string
    /** In the chain's own encoding. */
    assetId: string
}

export type RampContractFixtures = {
    /** The network the fixture ids belong to. */
    scope: ChainScope
    native: RampContractAsset
    nonNative: RampContractAsset
    /** A CAIP-19 id of another chain. */
    foreignRouterAssetId: string
    /** Ids the adapter can't read. */
    malformedRouterAssetIds: string[]
}

/** Every chain package runs this against its own ramp adapter. */
export const rampContractTests = (
    makeAdapter: () => RampChainAdapter,
    fixtures: RampContractFixtures,
): void => {
    describe(`RampChainAdapter contract: ${makeAdapter().chainId}`, () => {
        it("maps the native asset's router id to the chain's own id", () => {
            expect(
                makeAdapter().fromRouterAssetId(
                    fixtures.native.routerAssetId,
                    fixtures.scope,
                ),
            ).toBe(fixtures.native.assetId)
        })

        it("maps another asset's router id to the chain's own id", () => {
            expect(
                makeAdapter().fromRouterAssetId(
                    fixtures.nonNative.routerAssetId,
                    fixtures.scope,
                ),
            ).toBe(fixtures.nonNative.assetId)
        })

        it("reads no other chain's asset", () => {
            expect(
                makeAdapter().fromRouterAssetId(
                    fixtures.foreignRouterAssetId,
                    fixtures.scope,
                ),
            ).toBeNull()
        })

        it('reads no malformed id', () => {
            const adapter = makeAdapter()

            for (const routerAssetId of fixtures.malformedRouterAssetIds) {
                expect(
                    adapter.fromRouterAssetId(routerAssetId, fixtures.scope),
                ).toBeNull()
            }
        })
    })
}
