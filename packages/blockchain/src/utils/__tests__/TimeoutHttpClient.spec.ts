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

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BaseHTTPClientError } from 'algosdk'
import { TimeoutHttpClient } from '../TimeoutHttpClient'

// Node's `AbortSignal.timeout` is driven by an internal (libuv) timer that
// @sinonjs fake timers do not intercept, so the ceiling is proven with REAL
// timers and small ceilings — this exercises the actual abort path rather than
// mock behavior. Read < submit, with a comfortable gap between them.
const READ_TIMEOUT = 40
const SUBMIT_TIMEOUT = 160
// Sits strictly between the read and submit ceilings.
const BETWEEN_CEILINGS = 90
const TOKEN_HEADER = { 'X-Algo-API-Token': 'test-token' }
const BASE_SERVER = 'https://algod.example.com'

const wait = (ms: number): Promise<void> =>
    new Promise(resolve => {
        setTimeout(resolve, ms)
    })

type FetchArgs = { url: string; options: RequestInit }

/**
 * Realistic fetch mock: honors the injected AbortSignal so aborts surface as
 * the signal's TimeoutError, exactly as a real network request would. Never
 * resolves on its own, so only the timeout can settle the promise.
 */
const createAbortAwareFetch = (): {
    fetch: typeof fetch
    calls: FetchArgs[]
} => {
    const calls: FetchArgs[] = []
    const fetchMock = vi.fn((url: string, options: RequestInit) => {
        calls.push({ url, options })
        const { signal } = options
        return new Promise<Response>((_resolve, reject) => {
            if (signal?.aborted) {
                reject(signal.reason)
                return
            }
            signal?.addEventListener('abort', () => {
                reject(signal.reason)
            })
        })
    })
    return { fetch: fetchMock as unknown as typeof fetch, calls }
}

const createResolvingFetch = (
    response: Response,
): { fetch: typeof fetch; calls: FetchArgs[] } => {
    const calls: FetchArgs[] = []
    const fetchMock = vi.fn((url: string, options: RequestInit) => {
        calls.push({ url, options })
        return Promise.resolve(response)
    })
    return { fetch: fetchMock as unknown as typeof fetch, calls }
}

const buildClient = () =>
    new TimeoutHttpClient(
        TOKEN_HEADER,
        BASE_SERVER,
        undefined,
        READ_TIMEOUT,
        SUBMIT_TIMEOUT,
    )

describe('TimeoutHttpClient', () => {
    afterEach(() => {
        vi.restoreAllMocks()
        vi.useRealTimers()
    })

    describe('AbortSignal ceiling by HTTP method', () => {
        it('passes an AbortSignal to fetch on get', async () => {
            const { fetch, calls } = createResolvingFetch(
                new Response(new Uint8Array(), { status: 200 }),
            )
            vi.stubGlobal('fetch', fetch)

            await buildClient().get('/v2/status')

            expect(calls[0].options.signal).toBeInstanceOf(AbortSignal)
        })

        it('aborts a get at the read ceiling with a TimeoutError', async () => {
            const { fetch } = createAbortAwareFetch()
            vi.stubGlobal('fetch', fetch)

            // AbortSignal.timeout aborts with a `TimeoutError` DOMException,
            // which Task 3's toAlgodError classifies as retryable.
            await expect(buildClient().get('/v2/status')).rejects.toThrow(
                expect.objectContaining({ name: 'TimeoutError' }),
            )
        })

        it('does not abort a post at the read ceiling but does at the submit ceiling', async () => {
            const { fetch } = createAbortAwareFetch()
            vi.stubGlobal('fetch', fetch)

            const promise = buildClient().post(
                '/v2/transactions',
                new Uint8Array([1, 2, 3]),
            )
            let settled = false
            promise.catch(() => {
                settled = true
            })

            // Past the read ceiling but before the submit ceiling: a POST must
            // still be pending because it uses the longer (submit) window.
            await wait(BETWEEN_CEILINGS)
            expect(settled).toBe(false)

            // The submit ceiling still fires eventually.
            await expect(promise).rejects.toThrow()
        })

        it('aborts a delete at the read ceiling', async () => {
            const { fetch } = createAbortAwareFetch()
            vi.stubGlobal('fetch', fetch)

            await expect(buildClient().delete('/v2/foo')).rejects.toThrow()
        })

        it('rejects a never-resolving get so the spinner always resolves', async () => {
            const { fetch } = createAbortAwareFetch()
            vi.stubGlobal('fetch', fetch)

            // fetch never resolves on its own; only the read-ceiling abort can
            // settle this promise.
            await expect(buildClient().get('/v2/status')).rejects.toThrow()
        })
    })

    describe('response and error shape', () => {
        it('resolves a 2xx response into a BaseHTTPClientResponse', async () => {
            const body = new TextEncoder().encode('{"ok":true}')
            const { fetch } = createResolvingFetch(
                new Response(body, {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                }),
            )
            vi.stubGlobal('fetch', fetch)

            const response = await buildClient().get('/v2/status')

            expect(response.status).toBe(200)
            expect(response.body).toBeInstanceOf(Uint8Array)
            expect(new TextDecoder().decode(response.body)).toBe('{"ok":true}')
        })

        it('throws a BaseHTTPClientError-shaped error on a non-2xx response', async () => {
            const errorBody = new TextEncoder().encode(
                '{"message":"account not found"}',
            )
            const { fetch } = createResolvingFetch(
                new Response(errorBody, {
                    status: 404,
                    statusText: 'Not Found',
                }),
            )
            vi.stubGlobal('fetch', fetch)

            let caught: unknown
            try {
                await buildClient().get('/v2/accounts/foo')
            } catch (error) {
                caught = error
            }

            expect(caught).toBeInstanceOf(Error)
            const httpError = caught as BaseHTTPClientError
            expect(httpError.response.status).toBe(404)
            expect(httpError.response.body).toBeInstanceOf(Uint8Array)
            expect((caught as Error).message).toContain('404')
            expect((caught as Error).message).toContain('account not found')
        })
    })

    describe('URL and header assembly', () => {
        it('resolves relative paths against the base server and merges token + request headers', async () => {
            const { fetch, calls } = createResolvingFetch(
                new Response(new Uint8Array(), { status: 200 }),
            )
            vi.stubGlobal('fetch', fetch)

            await buildClient().get(
                '/v2/accounts/ADDR',
                { format: 'json' },
                { 'X-Custom': 'value' },
            )

            expect(calls[0].url).toBe(
                'https://algod.example.com/v2/accounts/ADDR?format=json',
            )
            const headers = calls[0].options.headers as Record<string, string>
            expect(headers['X-Algo-API-Token']).toBe('test-token')
            expect(headers['X-Custom']).toBe('value')
        })
    })

    describe('body reading path', () => {
        // React Native's Response.arrayBuffer() routes through the
        // Blob/FileReader polyfill, whose per-char conversion is quadratic on
        // Hermes — a ~110KB indexer page measured ~19s of JS and ~1.5GB of
        // allocations on device (PERA-4953). Textual bodies must go through
        // the native text() path instead.
        it('reads JSON bodies via text(), never arrayBuffer()', async () => {
            const payload = JSON.stringify({ assets: [{ 'asset-id': 1 }] })
            const response = new Response(payload, {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
            const arrayBufferSpy = vi.spyOn(response, 'arrayBuffer')
            const { fetch } = createResolvingFetch(response)
            vi.stubGlobal('fetch', fetch)

            const result = await buildClient().get('/v2/accounts/ADDR')

            expect(arrayBufferSpy).not.toHaveBeenCalled()
            expect(new TextDecoder().decode(result.body)).toBe(payload)
        })

        it('reads msgpack bodies via arrayBuffer() to preserve raw bytes', async () => {
            const bytes = new Uint8Array([0x82, 0xa1, 0x61, 0x01, 0xff])
            const response = new Response(bytes, {
                status: 200,
                headers: { 'content-type': 'application/msgpack' },
            })
            const { fetch } = createResolvingFetch(response)
            vi.stubGlobal('fetch', fetch)

            const result = await buildClient().get('/v2/blocks/1', {
                format: 'msgpack',
            })

            expect(result.body).toEqual(bytes)
        })
    })
})
