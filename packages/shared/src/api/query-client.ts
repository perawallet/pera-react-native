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

import ky, {
    type SearchParamsOption,
    type KyInstance,
    type KyRequest,
    type KyResponse,
    type Options,
    BeforeRetryState,
    HTTPError,
} from 'ky'
import { config } from '@perawallet/wallet-core-config'
import { RequestConfiguration, ResponseConfiguration } from '../models/queries'
import { Network, Networks } from '../models/base-types'
import { logger } from '../utils'

type BackendInstances = {
    algod: KyInstance
    indexer: KyInstance
    pera: KyInstance
}

const logRequest = (request: KyRequest) => {
    logger.debug('Sending request', {
        url: request.url,
        method: request.method,
    })
}

const logResponse = (_: KyRequest, __: Options, response: KyResponse) => {
    logger.debug('Received response', {
        status: response.status,
        url: response.url,
    })
}

const logError = (error: HTTPError) => {
    logger.error('Request error encountered', {
        message: error.message,
        name: error.name,
        // safely attempt to get response info if available
        status: error.response?.status,
    })
    return error
}

const logRetry = ({ request, error, retryCount }: BeforeRetryState) => {
    logger.debug('Retrying request', {
        url: request.url,
        retryCount,
        errorMessage: error.message,
    })
}

const createFetchClient = (clients: Map<string, BackendInstances>) => {
    return async <TData, TVariables = unknown>(
        requestConfig: RequestConfiguration<TVariables>,
    ): Promise<ResponseConfiguration<TData>> => {
        if (!requestConfig.url) {
            throw new Error('URL is required')
        }

        const backends = clients.get(requestConfig.network)

        if (!backends) {
            throw new Error(
                'Could not get backends for ' + requestConfig.network,
            )
        }

        const client = backends[requestConfig.backend]

        if (!client) {
            throw new Error(
                'Could not get KY client for ' + requestConfig.backend,
            )
        }

        try {
            const path = requestConfig.url.startsWith('/')
                ? requestConfig.url.slice(1)
                : requestConfig.url

            const response = await client(path, {
                searchParams: requestConfig.params as SearchParamsOption,
                method: requestConfig.method,
                json: requestConfig.data,
                signal: requestConfig.signal,
                headers: requestConfig.headers,
            })

            const data = await response.json<TData>()

            return {
                data,
                status: response.status,
                statusText: response.statusText,
            }
        } catch (error) {
            if (config.debugEnabled) {
                console.log('Query error', error)
            }
            throw error
        }
    }
}

const clients = new Map<Network, BackendInstances>()

const setStandardHeaders = (request: KyRequest) => {
    request.headers.set('Content-Type', 'application/json')

    if (config.backendAPIKey?.length) {
        request.headers.set('X-API-Key', config.backendAPIKey)
    }
}

const standardHooks = {
    beforeRequest: [logRequest],
    afterResponse: [logResponse],
    beforeError: [logError],
    beforeRetry: [logRetry],
}

const mainnetPeraClient = ky.create({
    hooks: {
        ...standardHooks,
        beforeRequest: [setStandardHeaders, ...standardHooks.beforeRequest],
    },
    prefixUrl: config.mainnetBackendUrl,
})

const testnetPeraClient = ky.create({
    hooks: {
        ...standardHooks,
        beforeRequest: [setStandardHeaders, ...standardHooks.beforeRequest],
    },
    prefixUrl: config.testnetBackendUrl,
})
const mainnetAlgodClient = ky.create({
    hooks: {
        ...standardHooks,
        beforeRequest: [
            request => {
                request.headers.set('Content-Type', 'application/json')

                if (config.algodApiKey?.length) {
                    request.headers.set('X-Algo-API-Token', config.algodApiKey)
                }
            },
            ...standardHooks.beforeRequest,
        ],
    },
    prefixUrl: config.mainnetAlgodUrl,
})
const testnetAlgodClient = ky.create({
    hooks: {
        ...standardHooks,
        beforeRequest: [
            request => {
                request.headers.set('Content-Type', 'application/json')

                if (config.algodApiKey?.length) {
                    request.headers.set('X-Algo-API-Token', config.algodApiKey)
                }
            },
            ...standardHooks.beforeRequest,
        ],
    },
    prefixUrl: config.testnetAlgodUrl,
})

const mainnetIndexerClient = ky.create({
    hooks: {
        ...standardHooks,
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
            ...standardHooks.beforeRequest,
        ],
    },
    prefixUrl: config.mainnetIndexerUrl,
})
const testnetIndexerClient = ky.create({
    hooks: {
        ...standardHooks,
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
            ...standardHooks.beforeRequest,
        ],
    },
    prefixUrl: config.testnetIndexerUrl,
})

clients.set(Networks.mainnet, {
    algod: mainnetAlgodClient,
    indexer: mainnetIndexerClient,
    pera: mainnetPeraClient,
})
clients.set(Networks.testnet, {
    algod: testnetAlgodClient,
    indexer: testnetIndexerClient,
    pera: testnetPeraClient,
})

export const updateBackendHeaders = (headers: Map<string, string>) => {
    clients.forEach((client, network) => {
        clients.set(network, {
            ...client,
            algod: client.algod.extend({
                hooks: {
                    beforeRequest: [
                        setStandardHeaders,
                        request => {
                            headers.forEach((v, k) => {
                                request.headers.set(k, v)
                            })
                        },
                        logRequest,
                    ],
                    afterResponse: [logResponse],
                },
            }),
        })
    })
}

export const queryClient = createFetchClient(clients)

export default queryClient
