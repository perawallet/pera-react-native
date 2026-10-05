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
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
    type ChainCapabilityRestrictions,
} from '@perawallet/wallet-core-chain-contract'

// Algorand offers every capability; a composition root narrows per platform.
export const algorandCapabilityDefaults = Object.fromEntries(
    CHAIN_CAPABILITIES.map(capability => [capability, true]),
) as ChainCapabilities

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
