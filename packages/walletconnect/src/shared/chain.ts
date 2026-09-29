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
import { AlgorandWalletConnectChainId } from '../models'
import { getExpectedChainId } from './expectedChainId'

/**
 * The 4160 wildcard ("any Algorand chain") is acceptable on any network we
 * have an id for; an explicit id must match exactly. A missing chain id, or a
 * network with no expected id, is rejected rather than guessed.
 */
export const isChainIdAcceptable = (
    chainId: number | undefined,
    network: NetworkId,
): boolean => {
    if (chainId === undefined) return false
    const expected = getExpectedChainId(network)
    if (expected === null) return false
    if (chainId === AlgorandWalletConnectChainId.all) return true
    return chainId === expected
}
