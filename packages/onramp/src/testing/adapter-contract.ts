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
import type { RampChainAdapter } from '../chain-adapter'
import type { RampToken } from '../models'

type TokenRef = Pick<RampToken, 'id' | 'symbol'>

export interface RampContractFixtures {
    native: TokenRef
    nonNative: { token: TokenRef; assetId: string }
}

const DECIMAL = /^\d+$/

/** Every chain package runs this against its own ramp adapter. */
export const rampContractTests = (
    makeAdapter: () => RampChainAdapter,
    fixtures: RampContractFixtures,
): void => {
    describe(`RampChainAdapter contract: ${makeAdapter().chainId}`, () => {
        it('requests a non-empty list of distinct destination tokens', () => {
            const { destinationTokenIds } = makeAdapter()

            expect(destinationTokenIds.length).toBeGreaterThan(0)
            expect(new Set(destinationTokenIds).size).toBe(
                destinationTokenIds.length,
            )
        })

        it('tells the native token from any other', () => {
            const adapter = makeAdapter()

            expect(adapter.isNativeToken(fixtures.native)).toBe(true)
            expect(adapter.isNativeToken(fixtures.nonNative.token)).toBe(false)
        })

        it('maps each token to its on-chain id as a decimal string', () => {
            const adapter = makeAdapter()

            expect(adapter.toAssetId(fixtures.native)).toMatch(DECIMAL)
            expect(adapter.toAssetId(fixtures.nonNative.token)).toBe(
                fixtures.nonNative.assetId,
            )
            expect(fixtures.nonNative.assetId).toMatch(DECIMAL)
        })
    })
}
