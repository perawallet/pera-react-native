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
    http,
    HttpRequestError,
    RpcError,
    RpcRequestError,
    TimeoutError,
    type HttpTransport,
    type HttpTransportConfig,
} from 'viem'
import { buildIntegrityHeadersWhenReady } from '@perawallet/wallet-core-app-integrity'
import { config } from '@perawallet/wallet-core-config'
import { EVM_RPC_PIN_DOMAINS } from '../pinned-hosts'

// expo/fetch rejects an aborted request with FetchError, but viem only maps
// AbortError to TimeoutError, so a timeout would surface as HttpRequestError.
// A plain Error: DOMException isn't guaranteed on Hermes.
export const abortError = (): Error => {
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
        // oxlint-disable-next-line no-restricted-properties -- viem's transport fetch, wrapped only to reject aborts as an AbortError
        return globalThis.fetch(input, init)
    }
    if (signal.aborted) {
        return Promise.reject(abortError())
    }
    return new Promise<Response>((resolve, reject) => {
        const onAbort = () => reject(abortError())
        signal.addEventListener('abort', onAbort, { once: true })
        // oxlint-disable-next-line no-restricted-properties -- viem's transport fetch, wrapped only to reject aborts as an AbortError
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

// Pera's RPC proxy is guarded like the other Pera EVM routes; the key and
// token must never reach a public fallback or a custom node.
const isPeraRpcUrl = (url: string): boolean => {
    let host: string
    try {
        host = new URL(url).hostname
    } catch {
        return false
    }
    return EVM_RPC_PIN_DOMAINS.some(
        domain => host === domain || host.endsWith(`.${domain}`),
    )
}

// Built per request: the integrity token expires and renews while a client lives.
const fetchWithPeraHeaders = async (
    input: string | URL | Request,
    init?: RequestInit,
): Promise<Response> => {
    const headers = new Headers(init?.headers)
    if (config.backendAPIKey) headers.set('X-API-Key', config.backendAPIKey)
    for (const [name, value] of Object.entries(
        await buildIntegrityHeadersWhenReady(),
    )) {
        headers.set(name, value)
    }
    return fetchWithAbortError(input, { ...init, headers })
}

// viem prints the whole request body into these errors, and every request of
// a failed batch shares one; each caller's error wrapper then copies it. A
// batch of balance reads made that megabytes per copy, enough to stall the JS
// thread and run the app out of memory. The class, status, code and URL are
// what the error mapping reads, so they stay.
const withoutRequestBody = (error: unknown, method: string): unknown => {
    if (error instanceof TimeoutError) {
        return new TimeoutError({ body: { method }, url: error.url })
    }
    if (error instanceof HttpRequestError) {
        return new HttpRequestError({
            body: { method },
            cause: error.cause instanceof Error ? error.cause : undefined,
            details: error.details,
            headers: error.headers,
            status: error.status,
            url: error.url,
        })
    }
    if (error instanceof RpcRequestError) {
        return withoutRpcRequestBody(error, method)
    }
    // An error the node answered with arrives already mapped by its code
    // (InvalidParamsRpcError, …), carrying the body on its cause; every mapped
    // class is built from the cause, MethodNotFoundRpcError also from the method.
    if (error instanceof RpcError && error.cause instanceof RpcRequestError) {
        const Mapped = error.constructor as new (
            cause: RpcRequestError,
            options: { method: string },
        ) => RpcError
        return new Mapped(withoutRpcRequestBody(error.cause, method), {
            method,
        })
    }
    return error
}

const withoutRpcRequestBody = (
    error: RpcRequestError,
    method: string,
): RpcRequestError =>
    new RpcRequestError({
        body: { method },
        error: { code: error.code, data: error.data, message: error.details },
        url: error.url,
    })

export const evmHttpTransport = (
    url: string,
    transportConfig?: Omit<HttpTransportConfig, 'fetchFn'>,
): HttpTransport => {
    const transport = http(url, {
        ...transportConfig,
        fetchFn: isPeraRpcUrl(url) ? fetchWithPeraHeaders : fetchWithAbortError,
    })
    return params => {
        const built = transport(params)
        return {
            ...built,
            request: ((args, options) =>
                built.request(args, options).catch((error: unknown) => {
                    throw withoutRequestBody(error, args.method)
                })) as typeof built.request,
        }
    }
}
