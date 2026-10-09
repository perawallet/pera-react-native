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
    LEGACY_CHAIN_ID,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { getSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { algorandAccountsAdapter } from '@perawallet/wallet-core-chain-algorand/accounts'

// Unit specs skip the app bootstrap, so signer resolution over real accounts
// has no adapter unless a spec registers one.
export const registerAlgorandAccountsAdapter = (): void => {
    accountsChainAdapters.reset()
    accountsChainAdapters.register(algorandAccountsAdapter)
}

/**
 * Records `authAddress` as `address`'s authority on `scope` (default: the
 * selected network, which is what the readers ask) the way the syncer does;
 * `null` is an observed "signs for itself", which shadows the legacy record
 * fields.
 */
export const seedAuthority = (
    address: string,
    authAddress: string | null,
    scope: ChainScope = getSelectedScope(LEGACY_CHAIN_ID),
): void =>
    useAccountChainStateStore
        .getState()
        .setAccountChainState(
            scope,
            address,
            algorandAccountsAdapter.toChainState({ authAddress }),
        )
