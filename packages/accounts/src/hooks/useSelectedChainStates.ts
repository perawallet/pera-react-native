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
    type AccountChainState,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useAccountChainStateStore } from '../store'

/**
 * The slice entries for `chainId`'s selected scope. Changes on a network switch
 * and on any real slice write, which is what memos that resolve authority
 * through `getSelectedScope` have to depend on.
 */
export const useSelectedChainStates = (
    chainId: ChainId,
): Readonly<Record<string, AccountChainState>> | undefined => {
    const scope = useSelectedScope(chainId)
    return useAccountChainStateStore(state => state.states[toScopeKey(scope)])
}
