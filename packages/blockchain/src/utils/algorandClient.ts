/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    config,
    getNetworkConfig,
    type Network,
} from '@perawallet/wallet-core-config'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { Algodv2, Indexer } from 'algosdk'
import { useNetworkStore } from '../store'
import { toAlgodError } from '../errors'
import { TimeoutHttpClient } from './TimeoutHttpClient'

/**
 * Returns an instance of AlgorandClient for a specific network.
 * If no network is provided, defaults to the current active network from the store.
 *
 * The algod and indexer clients are built on {@link TimeoutHttpClient}, which
 * bounds every request with a per-method AbortSignal timeout (read ceiling for
 * GET/DELETE, submit ceiling for POST) so no call site can hang indefinitely.
 * @returns {AlgorandClient}
 */
export const getAlgorandClient = (networkOverride?: Network) => {
    const network = networkOverride ?? useNetworkStore.getState().network
    const networkConfig = getNetworkConfig(network)

    const algod = new Algodv2(
        new TimeoutHttpClient(
            { 'X-Algo-API-Token': config.algodApiKey },
            networkConfig.algodUrl,
            undefined,
            config.algodReadTimeout,
            config.algodSubmitTimeout,
        ),
        networkConfig.algodUrl,
    )

    const indexer = new Indexer(
        new TimeoutHttpClient(
            { 'X-Indexer-API-Token': config.indexerApiKey },
            networkConfig.indexerUrl,
            undefined,
            config.algodReadTimeout,
            config.algodSubmitTimeout,
        ),
        networkConfig.indexerUrl,
    )

    const client = AlgorandClient.fromClients({ algod, indexer })
    client.registerErrorTransformer(async error => toAlgodError(error))
    return client
}
