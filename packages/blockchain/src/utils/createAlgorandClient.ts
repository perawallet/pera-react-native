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

import { config } from '@perawallet/wallet-core-config'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { Algodv2, Indexer } from 'algosdk'
import { toAlgodError } from '../errors'
import { TimeoutHttpClient } from './TimeoutHttpClient'

type AlgorandClientNetworkConfig = {
    algodUrl: string
    indexerUrl: string
    algodToken: string
    indexerToken: string
}

/**
 * Builds an {@link AlgorandClient} whose algod and indexer clients are backed by
 * {@link TimeoutHttpClient}, so every request is bounded by a per-method
 * AbortSignal timeout (read ceiling for GET/DELETE, submit ceiling for POST) and
 * no call site can hang indefinitely. The Pera error transformer is registered so
 * aborts/timeouts surface as typed, retryable {@link toAlgodError} errors.
 *
 * Shared by both {@link getAlgorandClient} and `useAlgorandClient`; callers layer
 * their own extras (validity window, signer) on top of the returned client.
 */
export const createTimeoutBoundedAlgorandClient = (
    networkConfig: AlgorandClientNetworkConfig,
): AlgorandClient => {
    const algod = new Algodv2(
        new TimeoutHttpClient(
            { 'X-Algo-API-Token': networkConfig.algodToken },
            networkConfig.algodUrl,
            undefined,
            config.algodReadTimeout,
            config.algodSubmitTimeout,
        ),
        networkConfig.algodUrl,
    )

    const indexer = new Indexer(
        new TimeoutHttpClient(
            { 'X-Indexer-API-Token': networkConfig.indexerToken },
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
