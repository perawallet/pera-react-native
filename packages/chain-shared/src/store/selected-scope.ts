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
    ScopeChangedError,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { selectChainNetworkId, useNetworkStore } from './network-store'

/** The non-reactive `useSelectedScope`, for code that runs outside React. */
export const getSelectedScope = (chainId: ChainId): ChainScope => ({
    chainId,
    networkId: selectChainNetworkId(useNetworkStore.getState(), chainId),
})

/**
 * @throws ScopeChangedError when `captured`'s own chain has switched network;
 * a switch on any other chain is not a change to `captured`.
 */
export const assertScopeUnchanged = (captured: ChainScope): void => {
    const live = getSelectedScope(captured.chainId)
    if (live.networkId !== captured.networkId) {
        throw new ScopeChangedError(captured, live)
    }
}
