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
import { createPublicClient, TimeoutError } from 'viem'
import { evmHttpTransport, fetchWithAbortError } from '../evmHttpTransport'

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
