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
    accountsChainAdapters,
    useAccountChainStateStore,
} from '@perawallet/wallet-core-accounts'
import {
    CHAIN_CAPABILITIES,
    scopeForLegacyNetwork,
    type ChainCapabilities,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { algorandAccountsAdapter } from '@perawallet/wallet-core-chain-algorand/accounts'
import { algorandDescriptor } from '@perawallet/wallet-core-chain-algorand/descriptor'
import { getProvider } from '@perawallet/wallet-extension-provider'

// Importing this file is the registration: specs that resolve signers need the
// production Algorand rules registered under the chain the pipeline signs on,
// and its descriptor for the signing schemes.
accountsChainAdapters.register(algorandAccountsAdapter)
getProvider().chains.register(
    algorandDescriptor,
    Object.fromEntries(
        CHAIN_CAPABILITIES.map(capability => [capability, false]),
    ) as ChainCapabilities,
)

/**
 * Records `authorityAddress` as `address`'s authority on `scope` the way the
 * syncer does; `null` is an observed "signs for itself".
 */
export const seedAuthority = (
    address: string,
    authorityAddress: string | null,
    scope: ChainScope = scopeForLegacyNetwork('mainnet'),
): void =>
    useAccountChainStateStore
        .getState()
        .setAccountChainState(
            scope,
            address,
            algorandAccountsAdapter.toChainState({ authorityAddress }),
        )
