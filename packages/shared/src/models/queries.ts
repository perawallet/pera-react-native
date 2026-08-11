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

import { type Network } from './base-types'

export type RequestConfiguration<TData = unknown> = {
    backend: 'algod' | 'indexer' | 'pera' | 'backup'
    network: Network
    url?: string
    method: 'GET' | 'PUT' | 'PATCH' | 'POST' | 'DELETE'
    params?: object
    data?: TData | FormData
    /** Raw JSON string body — bypasses JSON.stringify to preserve large integer precision. */
    body?: string
    responseType?:
        | 'arraybuffer'
        | 'blob'
        | 'document'
        | 'json'
        | 'text'
        | 'stream'
    signal?: AbortSignal
    headers?: HeadersInit
    /** Per-attempt timeout in ms. Overrides ky's 10s default; `false` disables it. */
    timeout?: number | false
}

export type ResponseConfiguration<TData = unknown> = {
    data: TData
    status: number
    statusText: string
}

export type ResponseErrorConfiguration<TError = unknown> = TError
