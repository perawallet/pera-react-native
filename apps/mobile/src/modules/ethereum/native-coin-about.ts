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

import {
    i18nKey,
    type EvmChainId,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'

export type EvmNativeCoinAbout = {
    descriptionKey: I18nKey
    websiteUrl: string
}

const ETHER: EvmNativeCoinAbout = {
    descriptionKey: i18nKey('asset_details.about.native_description.ether'),
    websiteUrl: 'https://ethereum.org',
}

// No backend serves a native coin's description or website, so they ship
// with the app; ETH on a rollup is the same coin as on Ethereum.
export const EVM_NATIVE_COIN_ABOUT: Record<EvmChainId, EvmNativeCoinAbout> = {
    ethereum: ETHER,
    base: ETHER,
    arbitrum: ETHER,
    optimism: ETHER,
    bsc: {
        descriptionKey: i18nKey('asset_details.about.native_description.bnb'),
        websiteUrl: 'https://www.bnbchain.org',
    },
    avalanche: {
        descriptionKey: i18nKey('asset_details.about.native_description.avax'),
        websiteUrl: 'https://www.avax.network',
    },
    polygon: {
        descriptionKey: i18nKey('asset_details.about.native_description.pol'),
        websiteUrl: 'https://polygon.technology',
    },
}
