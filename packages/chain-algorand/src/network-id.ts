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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { ALGORAND_CHAIN_ID } from './chain-id'

export const ALGORAND_NETWORK_IDS = [
    'mainnet',
    'testnet',
    'betanet',
    'custom',
] as const

/** The ids the algod client and the Pera backend are keyed by. */
export type AlgorandNetworkId = (typeof ALGORAND_NETWORK_IDS)[number]

const isAlgorandNetworkId = (value: string): value is AlgorandNetworkId =>
    (ALGORAND_NETWORK_IDS as readonly string[]).includes(value)

export const algorandScope = (
    networkId: AlgorandNetworkId,
): ChainScope & { chainId: typeof ALGORAND_CHAIN_ID } => ({
    chainId: ALGORAND_CHAIN_ID,
    networkId,
})

export const algorandNetworkOf = (scope: ChainScope): AlgorandNetworkId => {
    if (
        scope.chainId !== ALGORAND_CHAIN_ID ||
        !isAlgorandNetworkId(scope.networkId)
    ) {
        throw new Error(
            `Not an Algorand scope: ${scope.chainId}/${scope.networkId}`,
        )
    }
    return scope.networkId
}
