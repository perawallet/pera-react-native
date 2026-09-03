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

import type { Network } from '@perawallet/wallet-core-shared'
import { AlgorandChainId } from '../models'
import { getExpectedChainId } from './expectedChainId'

/**
 * Whether an inbound chain id is usable on `network`. WC v1 dApps may send
 * the wildcard 4160 ("any Algorand chain"), which is always acceptable; an
 * explicit chain id must match the active network exactly. A missing chain
 * id is rejected — we never guess which network a request was meant for.
 */
export const isChainIdAcceptable = (
    chainId: number | undefined,
    network: Network,
): boolean => {
    if (chainId === undefined) return false
    if (chainId === AlgorandChainId.all) return true
    return chainId === getExpectedChainId(network)
}
