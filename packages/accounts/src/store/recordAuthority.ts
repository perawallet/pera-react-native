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
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { accountsChainAdapters } from '../chain-adapter'
import { useAccountChainStateStore } from './accountChainState'
import { useAccountsStore } from './store'

/**
 * Records an authority observed outside a sync (discovery, Ledger verify, the
 * legacy migration). Fill-only in the slice, so a sync's fuller observation
 * wins; also persisted, because the slice does not survive a restart and the
 * account may have no synced row yet.
 */
export const recordAuthority = (
    scope: ChainScope,
    address: string,
    authorityAddress: string,
): void => {
    const key = toScopeKey(scope)
    useAccountChainStateStore.getState().fillAccountChainStates({
        [key]: {
            [address]: accountsChainAdapters
                .get(scope.chainId)
                .toChainState({ authorityAddress }),
        },
    })
    useAccountsStore
        .getState()
        .recordAuthorities({ [key]: { [address]: authorityAddress } })
}
