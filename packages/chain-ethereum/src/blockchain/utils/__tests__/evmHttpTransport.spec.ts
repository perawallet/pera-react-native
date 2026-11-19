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
import {
    createPublicClient,
    fallback,
    HttpRequestError,
    InvalidParamsRpcError,
    TimeoutError,
} from 'viem'
import { buildIntegrityHeadersWhenReady } from '@perawallet/wallet-core-app-integrity'
import { evmHttpTransport, fetchWithAbortError } from '../evmHttpTransport'

vi.mock('@perawallet/wallet-core-app-integrity', () => ({
    buildIntegrityHeadersWhenReady: vi.fn(async () => ({
        'x-app-integrity-token': 'test-integrity-token',
    })),
}))

// expo/fetch rejects an aborted request with a FetchError, not an AbortError.
const fetchThatRejectsOnAbort = () =>
    vi.fn(
        (_input: unknown, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () =>
                    reject(
                        Object.assign(new Error('Fetch request canceled'), {
                            name: 'FetchError',
                        }),
                    ),
                )
            }),
    )

describe('fetchWithAbortError', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('rejects with an AbortError when the signal aborts mid-request', async () => {
        vi.stubGlobal('fetch', fetchThatRejectsOnAbort())
        const controller = new AbortController()

        const pending = fetchWithAbortError('https://rpc.test', {
            signal: controller.signal,
        })
        controller.abort()

        await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    })

    it('rejects with an AbortError when the signal is already aborted', async () => {
        const fetchSpy = fetchThatRejectsOnAbort()
        vi.stubGlobal('fetch', fetchSpy)

        await expect(
            fetchWithAbortError('https://rpc.test', {
                signal: AbortSignal.abort(),
            }),
        ).rejects.toMatchObject({ name: 'AbortError' })
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('passes a response through, with or without a signal', async () => {
        const response = new Response('{}')
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(response)),
        )

        await expect(fetchWithAbortError('https://rpc.test')).resolves.toBe(
            response,
        )
        await expect(
            fetchWithAbortError('https://rpc.test', {
                signal: new AbortController().signal,
            }),
        ).resolves.toBe(response)
    })

    it('still resolves with a response when the signal aborts afterwards', async () => {
        const response = new Response('{}')
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(response)),
        )
        const controller = new AbortController()

        const result = await fetchWithAbortError('https://rpc.test', {
            signal: controller.signal,
        })
        controller.abort()

        expect(result).toBe(response)
    })

    it('surfaces a viem TimeoutError through evmHttpTransport', async () => {
        vi.stubGlobal('fetch', fetchThatRejectsOnAbort())
        const client = createPublicClient({
            transport: evmHttpTransport('https://rpc.test', {
                timeout: 50,
                retryCount: 0,
            }),
        })

        const error = await client.getChainId().catch(e => e)

        expect(error).toBeInstanceOf(TimeoutError)
    })
})

describe('evmHttpTransport errors', () => {
    const HOLDER = '0x00000000000000000000000000000000000000aa'
    const OTHER = '0x00000000000000000000000000000000000000bb'

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('names the method but leaves every batched request out of an HTTP failure', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(new Response('busy', { status: 503 }))),
        )
        const client = createPublicClient({
            transport: evmHttpTransport('https://rpc.test', {
                retryCount: 0,
                batch: true,
            }),
        })

        const [error] = await Promise.all([
            client.getBalance({ address: HOLDER }).catch(e => e),
            client.getBalance({ address: OTHER }).catch(e => e),
        ])

        expect(error).toBeInstanceOf(HttpRequestError)
        expect(error).toMatchObject({ status: 503 })
        expect(error.message).toContain('eth_getBalance')
        expect(error.message).not.toContain(HOLDER.slice(2))
        expect(error.message).not.toContain(OTHER.slice(2))
    })

    it('leaves the request out of an error the node answered with, keeping its code', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve(
                    Response.json({
                        jsonrpc: '2.0',
                        id: 0,
                        error: { code: -32602, message: 'Archive requests' },
                    }),
                ),
            ),
        )
        const client = createPublicClient({
            transport: evmHttpTransport('https://rpc.test', { retryCount: 0 }),
        })

        const error = await client.getBalance({ address: HOLDER }).catch(e => e)

        expect(error).toBeInstanceOf(InvalidParamsRpcError)
        expect(error).toMatchObject({ code: -32602 })
        expect(error.message).toContain('eth_getBalance')
        expect(error.message).toContain('Archive requests')
        expect(error.message).not.toContain(HOLDER.slice(2))
    })

    it('leaves the request out of a timeout', async () => {
        vi.stubGlobal('fetch', fetchThatRejectsOnAbort())
        const client = createPublicClient({
            transport: evmHttpTransport('https://rpc.test', {
                timeout: 50,
                retryCount: 0,
            }),
        })

        const error = await client.getBalance({ address: HOLDER }).catch(e => e)

        expect(error).toBeInstanceOf(TimeoutError)
        expect(error.message).toContain('eth_getBalance')
        expect(error.message).not.toContain(HOLDER.slice(2))
    })
})

describe('evmHttpTransport integrity registration', () => {
    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
        vi.mocked(buildIntegrityHeadersWhenReady).mockReset()
    })

    it('reaches the public fallback while registration is still pending', async () => {
        vi.useFakeTimers()
        vi.mocked(buildIntegrityHeadersWhenReady).mockReturnValueOnce(
            new Promise(() => {}),
        )
        const fetchSpy = vi.fn(async (_input: unknown, _init?: RequestInit) =>
            Response.json({ jsonrpc: '2.0', id: 0, result: '0x1' }),
        )
        vi.stubGlobal('fetch', fetchSpy)
        const client = createPublicClient({
            transport: fallback(
                [
                    evmHttpTransport(
                        'https://mainnet.api.perawallet.app/api/v3/evm/1/rpc',
                        { timeout: 50, retryCount: 0 },
                    ),
                    evmHttpTransport('https://rpc.test', { retryCount: 0 }),
                ],
                { retryCount: 0 },
            ),
        })
        const pending = client.getChainId()

        await vi.advanceTimersByTimeAsync(50)

        await expect(pending).resolves.toBe(1)
        expect(fetchSpy).toHaveBeenCalledTimes(1)
        expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://rpc.test/')
    })

    it('times out while registration is pending without sending a late request', async () => {
        vi.useFakeTimers()
        let completeRegistration!: (headers: Record<string, string>) => void
        vi.mocked(buildIntegrityHeadersWhenReady).mockReturnValueOnce(
            new Promise(resolve => {
                completeRegistration = resolve
            }),
        )
        const fetchSpy = vi.fn()
        vi.stubGlobal('fetch', fetchSpy)
        const client = createPublicClient({
            transport: evmHttpTransport(
                'https://mainnet.api.perawallet.app/api/v3/evm/1/rpc',
                {
                    timeout: 50,
                    retryCount: 0,
                },
            ),
        })
        const pending = client.getChainId().catch(error => error)
        const settled = vi.fn()
        void pending.then(settled)

        await vi.advanceTimersByTimeAsync(50)
        expect(settled).toHaveBeenCalledWith(expect.any(TimeoutError))
        expect(fetchSpy).not.toHaveBeenCalled()

        completeRegistration({ 'x-app-integrity-token': 'late-token' })
        await vi.runAllTimersAsync()
        expect(fetchSpy).not.toHaveBeenCalled()
    })
})
