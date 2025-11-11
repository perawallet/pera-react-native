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

import type {
    SearchParamsOption,
    KyInstance,
    KyRequest,
    KyResponse,
    Options,
} from 'ky'
import { useAppStore } from '../store/app-store'
import { config } from '@perawallet/config'

export type RequestConfig<TData = unknown> = {
    url?: string
    method: 'GET' | 'PUT' | 'PATCH' | 'POST' | 'DELETE'
    params?: object
    data?: TData | FormData
    responseType?:
        | 'arraybuffer'
        | 'blob'
        | 'document'
        | 'json'
        | 'text'
        | 'stream'
    signal?: AbortSignal
    headers?: HeadersInit
}

export type ResponseConfig<TData = unknown> = {
    data: TData
    status: number
    statusText: string
}

export type ResponseErrorConfig<TError = unknown> = TError

export const logRequest = (request: KyRequest) => {
    if (config.debugEnabled) {
        console.log('Sending request', request)
    }
}

export const logResponse = (
    _: KyRequest,
    __: Options,
    response: KyResponse,
) => {
    if (config.debugEnabled) {
        console.log('Received response', response)
    }
}

export const createFetchClient = (clients: Map<string, KyInstance>) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return async <TData, _TError = unknown, TVariables = unknown>(
        requestConfig: RequestConfig<TVariables>,
    ): Promise<ResponseConfig<TData>> => {
        if (!requestConfig.url) {
            throw new Error('URL is required')
        }

        const network = useAppStore.getState().network ?? 'testnet'
        const client = clients.get(network)

        if (!client) {
            throw new Error('Could not get KY client')
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
