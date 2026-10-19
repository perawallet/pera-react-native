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

import { setCustomNetwork } from '@perawallet/wallet-core-chain-algorand/blockchain'
import {
    CUSTOM_NETWORK_ID,
    LEGACY_CHAIN_ID,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'

import {
    assertLocalNetReachable,
    LOCALNET_ALGOD_URL,
    LOCALNET_INDEXER_URL,
    LOCALNET_TOKEN,
} from './localnet'

let registered: Promise<ChainScope> | undefined

/**
 * The scope the app's own chain adapters resolve to LocalNet: the `custom`
 * network, saved through the network store the way a user saves a custom
 * node. Builders and fetchers take a scope and resolve their node from it, so
 * this is what lets a suite call them unmodified.
 *
 * Saved through the store, not `registerCustomNetworkSource`: the store is
 * that source, and chain-algorand builds every algod and indexer client from
 * it per request, so nothing has to be rebuilt after the save.
 */
export const localNetScope = (): Promise<ChainScope> => {
    registered ??= assertLocalNetReachable().then(
        ({ genesisId, genesisHash }) => {
            setCustomNetwork({
                algodUrl: LOCALNET_ALGOD_URL,
                algodToken: LOCALNET_TOKEN,
                indexerUrl: LOCALNET_INDEXER_URL,
                indexerToken: '',
                genesisId,
                genesisHash,
            })
            return { chainId: LEGACY_CHAIN_ID, networkId: CUSTOM_NETWORK_ID }
        },
    )
    return registered
}
