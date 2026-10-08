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

import { accountsChainAdapters } from '@perawallet/wallet-core-accounts/chain-adapter'
import type { ChainRegistry } from '@perawallet/wallet-core-chain-contract'
import { algorandAccountsAdapter } from '@perawallet/wallet-core-chain-algorand/accounts/adapter'
import {
    algorandCapabilityDefaults,
    algorandCapabilityRestrictions,
} from '@perawallet/wallet-core-chain-algorand/capability-defaults'
import { algorandDescriptor } from '@perawallet/wallet-core-chain-algorand/descriptor'

// Signer resolution routes through the adapter registered for the chain being
// signed on, so suites that resolve a signer need Algorand's registered.
accountsChainAdapters.register(algorandAccountsAdapter)

/** Registers Algorand as the app's composition root does; signer dispatch reads its schemes. */
export const registerAlgorandChain = (chains: ChainRegistry): void =>
    chains.register(
        algorandDescriptor,
        algorandCapabilityDefaults,
        algorandCapabilityRestrictions,
    )
