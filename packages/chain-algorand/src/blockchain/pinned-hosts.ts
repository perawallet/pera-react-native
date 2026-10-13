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

import type { ChainPinnedHosts } from '@perawallet/wallet-core-chain-contract'
import { getChainConfig } from '@perawallet/wallet-core-config'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { AlgorandRemoteConfigKeys } from './remote-config'

const PINNED_NETWORKS = ['mainnet', 'testnet'] as const

// The public default provider domain (dev builds), plus Pera-owned hostnames
// that CI builds inject via env config (see tools/check-pinned-chains.mjs).
const ALGORAND_PIN_DOMAINS = ['algonode.cloud', 'perawallet.app'] as const

export const algorandPinnedHosts = (): ChainPinnedHosts => {
    const endpoints = PINNED_NETWORKS.map(networkId =>
        getChainConfig({ chainId: ALGORAND_CHAIN_ID, networkId }),
    )
    return {
        flag: AlgorandRemoteConfigKeys.enable_ssl_pinning_algod,
        urls: [
            ...endpoints.map(({ algodUrl }) => algodUrl),
            ...endpoints.map(({ indexerUrl }) => indexerUrl),
        ],
        domains: ALGORAND_PIN_DOMAINS,
    }
}
