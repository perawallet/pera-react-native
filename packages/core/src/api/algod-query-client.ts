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

//TODO the kubb generated code looks for these types here so we duplicate in all 3 places
export type RequestConfig<TData = unknown> = {
  url?: string
  method: 'GET' | 'PUT' | 'PATCH' | 'POST' | 'DELETE'
  params?: object
  data?: TData | FormData
  responseType?: 'arraybuffer' | 'blob' | 'document' | 'json' | 'text' | 'stream'
  signal?: AbortSignal
  headers?: HeadersInit
}

export type ResponseConfig<TData = unknown> = {
  data: TData
  status: number
  statusText: string
}

export type ResponseErrorConfig<TError = unknown> = TError

const clients = new Map<'testnet' | 'mainnet', KyInstance>()

const mainnetClient = ky.create({
    hooks: {
        beforeRequest: [
            request => {
                request.headers.set('Content-Type', 'application/json')

                if (config.algodApiKey?.length) {
                    request.headers.set('X-Algo-API-Token', config.algodApiKey)
                }
            },
            logRequest,
        ],
        afterResponse: [logResponse],
    },
    prefixUrl: config.mainnetAlgodUrl,
})
const testnetClient = ky.create({
    hooks: {
        beforeRequest: [
            request => {
                request.headers.set('Content-Type', 'application/json')

                if (config.algodApiKey?.length) {
                    request.headers.set('X-Algo-API-Token', config.algodApiKey)
                }
            },
            logRequest,
        ],
        afterResponse: [logResponse],
    },
    prefixUrl: config.testnetAlgodUrl,
})

clients.set('mainnet', mainnetClient)
clients.set('testnet', testnetClient)

export const algodFetchClient = createFetchClient(clients)

export default algodFetchClient
