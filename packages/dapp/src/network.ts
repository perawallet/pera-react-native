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
    getNetworkConfig,
    Networks,
    type Network,
} from '@perawallet/wallet-core-config'

const BAKED_NETWORKS: Network[] = [
    Networks.mainnet,
    Networks.testnet,
    Networks.betanet,
]

// A custom network is reported as the baked network sharing its genesis hash
// and never by name: the custom-network envelope is plaintext, so a forged one
// with a MainNet hash and an attacker's node URLs must not make the wallet tell
// a dApp "this is MainNet" — the hash check is what a dApp actually validates.
export const resolveReportedNetwork = (
    network: Network,
    customGenesisHash: string | undefined,
): Network | undefined => {
    if (network !== Networks.custom) return network
    if (!customGenesisHash) return undefined
    return BAKED_NETWORKS.find(
        baked => getNetworkConfig(baked).genesisHash === customGenesisHash,
    )
}
