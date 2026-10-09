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

import { describe, expect, it, vi } from 'vitest'

vi.mock('@perawallet/wallet-core-config', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-config')),
    config: {
        mainnetCardW3CardAppId: 'main-w3',
        mainnetCardKillswitchAppId: 'main-ks',
        mainnetCardAutoDrawProgramHash: 'main-pin',
        mainnetCardUsdcAssetId: 'main-usdc',
        testnetCardW3CardAppId: 'test-w3',
        testnetCardKillswitchAppId: 'test-ks',
        testnetCardAutoDrawProgramHash: 'test-pin',
        testnetCardUsdcAssetId: 'test-usdc',
    },
}))

import { algorandCardConfig } from '../config'

describe('algorandCardConfig', () => {
    it("reads each Pera-backed network's own build-time card ids", () => {
        expect(algorandCardConfig('mainnet')).toEqual({
            mainAppId: 'main-w3',
            killswitchAppId: 'main-ks',
            autoDrawProgramHash: 'main-pin',
            usdcAssetId: 'main-usdc',
        })
        expect(algorandCardConfig('testnet')).toEqual({
            mainAppId: 'test-w3',
            killswitchAppId: 'test-ks',
            autoDrawProgramHash: 'test-pin',
            usdcAssetId: 'test-usdc',
        })
    })

    it.each(['betanet', 'custom'] as const)(
        'has no card deployment on %s, never borrowing another network',
        network => {
            expect(algorandCardConfig(network)).toEqual({
                mainAppId: '',
                killswitchAppId: '',
                autoDrawProgramHash: '',
                usdcAssetId: '',
            })
        },
    )
})
