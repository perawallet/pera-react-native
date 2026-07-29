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
import { getCustomNetworkConfig } from '../store'

/**
 * The genesis hash to compare signable transactions against.
 *
 * Synchronous and network-free by design. mainnet/testnet/betanet use their
 * build-time-pinned value; `custom` uses whatever was saved in its config store,
 * fetched once at configuration time rather than on every signing attempt.
 *
 * This is stronger than resolving at signing time: NOTHING on the signing path
 * can be influenced by a node response. An unconfigured custom slot returns `''`,
 * which `assertTransactionsMatchNetwork` rejects outright — an empty hash is never
 * a valid chain identity, so this fails closed.
 */
export const getExpectedGenesisHash = (network: Network): string => {
    if (network !== Networks.custom)
        return getNetworkConfig(network).genesisHash

    return getCustomNetworkConfig()?.genesisHash ?? ''
}
