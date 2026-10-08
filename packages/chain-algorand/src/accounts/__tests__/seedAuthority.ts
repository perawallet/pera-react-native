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

import { useAccountChainStateStore } from '@perawallet/wallet-core-accounts'
import {
    scopeForLegacyNetwork,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { toAlgorandChainState } from '../chain-state'

/**
 * Records `authAddress` as `address`'s authority on `scope` the way the syncer
 * does; `null` is an observed "signs for itself", which shadows the legacy
 * record fields.
 */
export const seedAuthority = (
    address: string,
    authAddress: string | null,
    scope: ChainScope = scopeForLegacyNetwork('mainnet'),
): void =>
    useAccountChainStateStore
        .getState()
        .setAccountChainState(
            scope,
            address,
            toAlgorandChainState({ authAddress }),
        )
