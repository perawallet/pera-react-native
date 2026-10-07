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

import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import type { CapabilityRequirement } from './useCapability'

// Rekey entry points act on an account, and Algorand is the only account chain
// until WalletAccount carries a chain id.
export const REKEY_REQUIREMENT: CapabilityRequirement = {
    platform: 'rekeyFlows',
    chain: { chainId: LEGACY_CHAIN_ID, capability: 'rekey' },
}

// Messages hosts notifications, the asset inbox and multisig invitations, so it
// stays reachable while any one of them is on.
export const MESSAGES_REQUIREMENTS: readonly CapabilityRequirement[] = [
    { anyChain: 'notifications' },
    { anyChain: 'assetInbox' },
    { anyChain: 'multisig' },
]
