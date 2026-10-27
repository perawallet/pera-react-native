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
    type ChainCapability,
} from '@perawallet/wallet-core-chain-contract'

// Each needs an adapter in every registry CAPABILITY_ADAPTERS lists for it; the app's parity spec fails otherwise.
const ENABLED: ReadonlySet<ChainCapability> = new Set<ChainCapability>([
    'send',
    'receive',
    'history',
    'assets',
    'assetSearch',
    'pricing',
    'watchAccounts',
    'privateKeys',
    'dappConnect',
    'ledger',
    'nft',
    // Still behind the app-wide enable_cloud_backup flag, as for Algorand.
    'cloudBackup',
])

// Off unless listed, so a capability added later starts off. Every EVM chain
// shares this set: they register the same adapters.
export const evmCapabilityDefaults = Object.fromEntries(
    CHAIN_CAPABILITIES.map(capability => [capability, ENABLED.has(capability)]),
) as ChainCapabilities
