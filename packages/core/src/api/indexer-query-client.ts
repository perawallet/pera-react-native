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

import ky, { type KyInstance } from 'ky'
import { config } from '@perawallet/config'
import { createFetchClient, logRequest, logResponse } from './query-client'

const clients = new Map<'testnet' | 'mainnet', KyInstance>()

const mainnetClient = ky.create({
    hooks: {
        beforeRequest: [
            request => {
                request.headers.set('Content-Type', 'application/json')

                if (config.indexerApiKey?.length) {
                    request.headers.set(
                        'X-Indexer-API-Token',
                        config.indexerApiKey,
                    )
                }
            },
        ],
    },
    prefixUrl: config.mainnetIndexerUrl,
})
const testnetClient = ky.create({
    hooks: {
        beforeRequest: [
            request => {
                request.headers.set('Content-Type', 'application/json')

                if (config.indexerApiKey?.length) {
                    request.headers.set(
                        'X-Indexer-API-Token',
                        config.indexerApiKey,
                    )
                }
            },
            logRequest,
        ],
        afterResponse: [logResponse],
    },
    prefixUrl: config.testnetIndexerUrl,
})

clients.set('mainnet', mainnetClient)
clients.set('testnet', testnetClient)

export const indexerFetchClient = createFetchClient(clients)

export default indexerFetchClient
