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

import type { ChainContext } from '@perawallet/wallet-core-chain-contract'
import type { NodeEndpointAdapter } from '@perawallet/wallet-core-chain-shared'
import { ETHEREUM_CHAIN_ID } from '../chain-id'
import { checkEvmRpcChainId } from './utils/checkEvmRpcChainId'

// Reads through ctx.getEndpoints(), which already carries a developer's
// override, so the URL shown is the one requests use.
export const createEthereumNodeEndpointAdapter = (
    ctx: ChainContext,
): NodeEndpointAdapter => ({
    chainId: ETHEREUM_CHAIN_ID,
    endpointUrl: networkId => ctx.getEndpoints()[networkId] || undefined,
    checkOverride: (networkId, url) =>
        checkEvmRpcChainId(url, networkId, ctx.timeouts),
})
