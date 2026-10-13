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

import { config } from '@perawallet/wallet-core-config'
import { Networks, type Network } from '@perawallet/wallet-core-shared'

export type AlgorandCardConfig = {
    /** W3Card (main) application id. */
    mainAppId: string
    killswitchAppId: string
    /**
     * Lowercase hex SHA-256 of the compiled AutoDraw program. Derived from the
     * app ids — the compile is deterministic over (template, app ids, genesis
     * hash), so rotating either app id invalidates this pin and both must move
     * together. Build-time only, never remote config: a remotely-settable
     * expected value would let whoever controls it approve any program the
     * wallet is asked to sign.
     */
    autoDrawProgramHash: string
    /** Settlement asset id the escrow contracts are deployed against. */
    usdcAssetId: string
}

const EMPTY_CARD_CONFIG: AlgorandCardConfig = {
    mainAppId: '',
    killswitchAppId: '',
    autoDrawProgramHash: '',
    usdcAssetId: '',
}

// Functions, not values, so `config` is read on every call and a test's config
// mock reaches it. A Record so a new network fails to compile until someone
// decides its card deployment.
const cardConfigByNetwork: Record<Network, () => AlgorandCardConfig> = {
    [Networks.mainnet]: () => ({
        mainAppId: config.mainnetCardW3CardAppId,
        killswitchAppId: config.mainnetCardKillswitchAppId,
        autoDrawProgramHash: config.mainnetCardAutoDrawProgramHash,
        usdcAssetId: config.mainnetCardUsdcAssetId,
    }),
    [Networks.testnet]: () => ({
        mainAppId: config.testnetCardW3CardAppId,
        killswitchAppId: config.testnetCardKillswitchAppId,
        autoDrawProgramHash: config.testnetCardAutoDrawProgramHash,
        usdcAssetId: config.testnetCardUsdcAssetId,
    }),
    [Networks.betanet]: () => EMPTY_CARD_CONFIG,
    [Networks.custom]: () => EMPTY_CARD_CONFIG,
}

export const algorandCardConfig = (network: Network): AlgorandCardConfig =>
    cardConfigByNetwork[network]()
