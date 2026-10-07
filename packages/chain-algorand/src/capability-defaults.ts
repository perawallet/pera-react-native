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
    type ChainCapabilities,
    type ChainCapabilityRestrictions,
} from '@perawallet/wallet-core-chain-contract'

// Explicit, so a new capability forces an Algorand decision.
// privateKeys is off because accounts enter through mnemonics; contractDecoding
// is off because application calls are decoded from the group, not from ABIs.
export const algorandCapabilityDefaults: ChainCapabilities = {
    send: true,
    receive: true,
    history: true,
    assets: true,
    pricing: true,
    messageSigning: true,
    dappConnect: true,
    customNetworks: true,
    watchAccounts: true,
    ledger: true,
    multisig: true,
    rekey: true,
    quantumAccounts: true,
    staking: true,
    swap: true,
    card: true,
    assetInbox: true,
    nameService: true,
    onramp: true,
    giftCards: true,
    discover: true,
    feeDelegation: true,
    arc0027: true,
    liquidAuth: true,
    notifications: true,
    cloudBackup: true,
    mnemonicBackup: true,
    secureBackup: true,
    nft: true,
    manageAssets: true,
    privateKeys: false,
    contractDecoding: false,
    priceHistory: true,
    balanceHistory: true,
    assetSearch: true,
    assetFavorites: true,
    priceAlerts: true,
    csvExport: true,
}

// These need the Pera backend, which BetaNet and custom nodes don't have.
const PERA_BACKED = ['developer-override'] as const

export const algorandCapabilityRestrictions: ChainCapabilityRestrictions = {
    // onramp buys real ALGO and USDC, so live only.
    onramp: ['developer', 'developer-override'],
    priceHistory: PERA_BACKED,
    balanceHistory: PERA_BACKED,
    assetSearch: PERA_BACKED,
    assetFavorites: PERA_BACKED,
    priceAlerts: PERA_BACKED,
    csvExport: PERA_BACKED,
    notifications: PERA_BACKED,
    assetInbox: PERA_BACKED,
}
