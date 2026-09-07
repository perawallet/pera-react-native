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

import type { Network } from './base-types'

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
    /**
     * Per-request retry overrides, deep-merged into the client's retry config
     * (ky merges nested options rather than replacing them), so omitted keys
     * keep the client's values.
     *
     * The key use is `methods`: ky's default retry method list excludes POST,
     * so a POST is never retried no matter how the failure classifies. Opt an
     * idempotent POST in with `{ methods: ['post'] }`.
     */
    retry?: RequestRetryOverrides
}

/**
 * Structural subset of ky's `RetryOptions` — kept local so the model layer
 * doesn't depend on the HTTP client.
 */
export type RequestRetryOverrides = {
    limit?: number
    /** Lowercase HTTP methods, e.g. `['post']`. */
    methods?: string[]
    statusCodes?: number[]
    /**
     * `true` forces a retry and bypasses every built-in check; `undefined`
     * falls through to ky's default handling (timeout, then `statusCodes`);
     * `false` refuses outright. Return `undefined` rather than `false` to add
     * a retry reason without discarding the defaults.
     */
    shouldRetry?: (state: {
        error: Error
        retryCount: number
    }) => boolean | undefined | Promise<boolean | undefined>
}

export type ResponseConfiguration<TData = unknown> = {
    data: TData
    status: number
    statusText: string
}

export type ResponseErrorConfiguration<TError = unknown> = TError
