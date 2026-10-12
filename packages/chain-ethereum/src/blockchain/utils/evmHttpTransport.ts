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

import { http, type HttpTransport, type HttpTransportConfig } from 'viem'

// expo/fetch rejects an aborted request with FetchError, but viem only maps
// AbortError to TimeoutError, so a timeout would surface as HttpRequestError.
// A plain Error: DOMException isn't guaranteed on Hermes.
const abortError = (): Error => {
    const error = new Error('The operation was aborted')
    error.name = 'AbortError'
    return error
}

export const fetchWithAbortError = (
    input: string | URL | Request,
    init?: RequestInit,
): Promise<Response> => {
    const signal = init?.signal
    if (!signal) {
        return globalThis.fetch(input, init)
    }
    if (signal.aborted) {
        return Promise.reject(abortError())
    }
    return new Promise<Response>((resolve, reject) => {
        const onAbort = () => reject(abortError())
        signal.addEventListener('abort', onAbort, { once: true })
        globalThis.fetch(input, init).then(
            response => {
                signal.removeEventListener('abort', onAbort)
                resolve(response)
            },
            error => {
                signal.removeEventListener('abort', onAbort)
                reject(error)
            },
        )
    })
}

export const evmHttpTransport = (
    url: string,
    config?: Omit<HttpTransportConfig, 'fetchFn'>,
): HttpTransport => http(url, { ...config, fetchFn: fetchWithAbortError })
