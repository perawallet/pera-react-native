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

import type { NetworkId } from '@perawallet/wallet-core-chain-contract'
import type { NodeEndpointAdapter } from '@perawallet/wallet-core-chain-shared'
import {
    getAlgorandChainConfig,
    UnconfiguredScopeError,
} from '@perawallet/wallet-core-config'
import { ALGORAND_CHAIN_ID } from '../chain-id'

// Reports algod only: it is the node every Algorand request starts from, and
// a saved custom node shows through getAlgorandChainConfig's overlay.
export const algorandNodeEndpoint: NodeEndpointAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    endpointUrl: (networkId: NetworkId) => {
        try {
            const { algodUrl } = getAlgorandChainConfig({
                chainId: ALGORAND_CHAIN_ID,
                networkId,
            })
            return algodUrl === '' ? undefined : algodUrl
        } catch (error) {
            if (error instanceof UnconfiguredScopeError) return undefined
            throw error
        }
    },
}
