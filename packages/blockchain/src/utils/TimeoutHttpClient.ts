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
    type BaseHTTPClient,
    type BaseHTTPClientError,
    type BaseHTTPClientResponse,
    type TokenHeader,
} from 'algosdk'

/**
 * A query is an optional key-value object of query parameters. Mirrors
 * algosdk's internal `Query<string>` shape without importing the private type.
 */
type Query = Record<string, unknown> & { format?: string }

/**
 * Error thrown on a non-2xx response. Implements algosdk's `BaseHTTPClientError`
 * so algosdk's decoders and Pera's `toAlgodError` (`fromApiError`) can read
 * `.response.status` / `.response.body` exactly as they do for the SDK's own
 * client.
 */
class TimeoutHttpClientError extends Error implements BaseHTTPClientError {
    constructor(
        message: string,
        public response: BaseHTTPClientResponse,
    ) {
        super(message)
        this.name = 'TimeoutHttpClientError'
        this.response = response
    }
}

/**
 * A `BaseHTTPClient` that gives every algod/indexer request a bounded lifetime
 * via `AbortSignal.timeout(...)`, injected once at client construction so all
 * call sites inherit it with no per-call changes.
 *
 * The ceiling is chosen by HTTP method:
 * - `get` / `delete` → `readTimeoutMs` (reads: balances, polling, lookups)
 * - `post` → `submitTimeoutMs` (broadcast/simulate/compile get the longer window)
 *
 * URL resolution, header merging and response/error formatting deliberately
 * replicate algosdk's (non-public) `URLTokenBaseHTTPClient` so decoding stays
 * compatible. Unlike algokit's client, there is NO retry loop: bounded failure
 * is the goal (TanStack Query retries reads; the signing machine retries
 * transport).
 */
export class TimeoutHttpClient implements BaseHTTPClient {
    private readonly baseURL: URL
    private readonly tokenHeader: TokenHeader
    private readonly readTimeoutMs: number
    private readonly submitTimeoutMs: number

    constructor(
        tokenHeader: TokenHeader,
        baseServer: string,
        port: string | number | undefined,
        readTimeoutMs: number,
        submitTimeoutMs: number,
    ) {
        // Append a trailing slash so relative paths resolve against the full
        // base path rather than replacing its last segment.
        const fixedBaseServer = baseServer.endsWith('/')
            ? baseServer
            : `${baseServer}/`
        const baseServerURL = new URL(fixedBaseServer)
        if (typeof port !== 'undefined') {
            baseServerURL.port = port.toString()
        }

        if (baseServerURL.protocol.length === 0) {
            throw new Error(
                'Invalid base server URL, protocol must be defined.',
            )
        }

        this.baseURL = baseServerURL
        this.tokenHeader = tokenHeader
        this.readTimeoutMs = readTimeoutMs
        this.submitTimeoutMs = submitTimeoutMs
    }

    private getURL(relativePath: string, query?: Query): string {
        let fixedRelativePath: string
        if (relativePath.startsWith('./')) {
            fixedRelativePath = relativePath
        } else if (relativePath.startsWith('/')) {
            fixedRelativePath = `.${relativePath}`
        } else {
            fixedRelativePath = `./${relativePath}`
        }
        const address = new URL(fixedRelativePath, this.baseURL)
        if (query) {
            for (const [key, value] of Object.entries(query)) {
                address.searchParams.set(key, String(value))
            }
        }
        return address.toString()
    }

    private static formatFetchResponseHeaders(
        headers: Headers,
    ): Record<string, string> {
        const headersObj: Record<string, string> = {}
        headers.forEach((value, key) => {
            headersObj[key] = value
        })
        return headersObj
    }

    /**
     * On React Native, `Response.arrayBuffer()` routes through the
     * Blob/FileReader polyfill whose per-char conversion is quadratic on
     * Hermes — a ~110KB indexer page measured ~19s of JS-thread block and
     * ~1.5GB of allocations on device (PERA-4953). `text()` is native and
     * linear, so textual bodies are read as text and re-encoded; only binary
     * (msgpack) bodies pay the arrayBuffer path, and those are small.
     */
    private static async readBody(res: Response): Promise<Uint8Array> {
        const contentType = res.headers.get('content-type') ?? ''
        if (contentType.includes('application/msgpack')) {
            return new Uint8Array(await res.arrayBuffer())
        }
        const encoded = new TextEncoder().encode(await res.text())
        // Zero-copy re-wrap with the local realm's constructor: the polyfilled
        // encoder can return a foreign-realm Uint8Array that fails instanceof
        // checks downstream.
        return new Uint8Array(
            encoded.buffer,
            encoded.byteOffset,
            encoded.byteLength,
        )
    }

    private static async checkHttpError(res: Response): Promise<void> {
        if (res.ok) {
            return
        }

        let body: Uint8Array | undefined
        let bodyErrorMessage: string | undefined

        try {
            body = await TimeoutHttpClient.readBody(res)
            const decoded: unknown = JSON.parse(new TextDecoder().decode(body))
            if (
                typeof decoded === 'object' &&
                decoded !== null &&
                'message' in decoded &&
                typeof (decoded as { message: unknown }).message === 'string'
            ) {
                bodyErrorMessage = (decoded as { message: string }).message
            }
        } catch {
            // Ignore any error while parsing the error response body.
        }

        let message = `Network request error. Received status ${res.status} (${res.statusText})`
        if (bodyErrorMessage) {
            message += `: ${bodyErrorMessage}`
        }

        throw new TimeoutHttpClientError(message, {
            body: body ?? new Uint8Array(),
            status: res.status,
            headers: TimeoutHttpClient.formatFetchResponseHeaders(res.headers),
        })
    }

    private static async formatFetchResponse(
        res: Response,
    ): Promise<BaseHTTPClientResponse> {
        await TimeoutHttpClient.checkHttpError(res)
        return {
            body: await TimeoutHttpClient.readBody(res),
            status: res.status,
            headers: TimeoutHttpClient.formatFetchResponseHeaders(res.headers),
        }
    }

    private buildHeaders(
        requestHeaders?: Record<string, string>,
    ): Record<string, string> {
        return {
            ...this.tokenHeader,
            ...(requestHeaders ?? {}),
        }
    }

    async get(
        relativePath: string,
        query?: Query,
        requestHeaders?: Record<string, string>,
        customOptions?: Record<string, unknown>,
    ): Promise<BaseHTTPClientResponse> {
        const res = await fetch(this.getURL(relativePath, query), {
            ...(customOptions ?? {}),
            headers: this.buildHeaders(requestHeaders),
            signal: AbortSignal.timeout(this.readTimeoutMs),
        })

        return TimeoutHttpClient.formatFetchResponse(res)
    }

    async post(
        relativePath: string,
        data: Uint8Array,
        query?: Query,
        requestHeaders?: Record<string, string>,
        customOptions?: Record<string, unknown>,
    ): Promise<BaseHTTPClientResponse> {
        const res = await fetch(this.getURL(relativePath, query), {
            ...(customOptions ?? {}),
            method: 'POST',
            body: data as BodyInit,
            headers: this.buildHeaders(requestHeaders),
            signal: AbortSignal.timeout(this.submitTimeoutMs),
        })

        return TimeoutHttpClient.formatFetchResponse(res)
    }

    async delete(
        relativePath: string,
        data?: Uint8Array,
        query?: Query,
        requestHeaders?: Record<string, string>,
        customOptions?: Record<string, unknown>,
    ): Promise<BaseHTTPClientResponse> {
        const res = await fetch(this.getURL(relativePath, query), {
            ...(customOptions ?? {}),
            method: 'DELETE',
            body: data as BodyInit | undefined,
            headers: this.buildHeaders(requestHeaders),
            signal: AbortSignal.timeout(this.readTimeoutMs),
        })

        return TimeoutHttpClient.formatFetchResponse(res)
    }
}
