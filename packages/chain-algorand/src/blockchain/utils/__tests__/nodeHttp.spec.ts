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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PeraNetworkError, logger } from '@perawallet/wallet-core-shared'
import { Networks } from '@perawallet/wallet-core-config'
import { setAlgorandChainContext } from '../../../chain-context'
import { testChainContext } from '../../../__tests__/context'
import { clearCustomNetwork, setCustomNetwork } from '../../store'
import { algorandNodeOf, fetchNodeJson } from '../nodeHttp'
// Registers the saved-node reader that getAlgorandChainConfig overlays on `custom`.
import '../algorandClient'

const MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const
const JSON_HEADERS = { 'content-type': 'application/json' }

const respondWith = (response: Response | (() => Promise<Response>)) => {
    const fetchMock = vi.fn(async () =>
        typeof response === 'function' ? response() : response,
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

// Settles only when the request's signal aborts, with the signal's reason.
const hangUntilAborted = () =>
    vi.stubGlobal(
        'fetch',
        (_url: string, { signal }: RequestInit) =>
            new Promise((_resolve, reject) => {
                signal?.addEventListener('abort', () => reject(signal.reason))
            }),
    )

const jsonResponse = (body: string, status = 200) =>
    new Response(body, { status, headers: JSON_HEADERS })

describe('algorandNodeOf', () => {
    const networkConfig = {
        algodUrl: 'https://algod.test',
        algodToken: 'algod-token',
        indexerUrl: 'https://indexer.test',
        indexerToken: 'indexer-token',
    }

    it('maps each backend to its URL, token header and token', () => {
        expect(algorandNodeOf(networkConfig, 'algod')).toEqual({
            url: 'https://algod.test',
            tokenHeader: 'X-Algo-API-Token',
            token: 'algod-token',
        })
        expect(algorandNodeOf(networkConfig, 'indexer')).toEqual({
            url: 'https://indexer.test',
            tokenHeader: 'X-Indexer-API-Token',
            token: 'indexer-token',
        })
    })
})

describe('fetchNodeJson', () => {
    beforeEach(() => {
        setAlgorandChainContext(testChainContext())
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
        clearCustomNetwork()
    })

    it("bounds a read by the registered context's read ceiling", async () => {
        setAlgorandChainContext({
            ...testChainContext(),
            timeouts: { readMs: 1_234, submitMs: 5_678 },
        })
        respondWith(jsonResponse('{}'))
        const timeout = vi.spyOn(AbortSignal, 'timeout')

        await fetchNodeJson(MAINNET, 'algod', '/v2/status')

        expect(timeout).toHaveBeenCalledWith(1_234)
    })

    it("reads the scope's node at the path with the params and token header", async () => {
        const fetchMock = respondWith(jsonResponse('{}'))

        await fetchNodeJson(MAINNET, 'indexer', '/v2/accounts/A/transactions', {
            params: { limit: 25, 'asset-id': '7' },
        })

        const [url] = fetchMock.mock.calls[0] as unknown as [string]
        expect(new URL(url).pathname).toBe('/v2/accounts/A/transactions')
        expect(new URL(url).searchParams.get('limit')).toBe('25')
        expect(new URL(url).searchParams.get('asset-id')).toBe('7')
    })

    it("sends the saved node's token in its backend's header, and none when it has no token", async () => {
        const fetchMock = respondWith(async () => jsonResponse('{}'))
        setCustomNetwork({
            algodUrl: 'http://10.0.0.5:4001',
            algodToken: 'a'.repeat(64),
            indexerUrl: 'http://10.0.0.5:8980',
            genesisHash: 'HASH',
            genesisId: 'dockernet-v1',
        })

        await fetchNodeJson(Networks.custom, 'algod', '/v2/status')
        await fetchNodeJson(Networks.custom, 'indexer', '/v2/status')

        const headersOf = (call: number) =>
            (fetchMock.mock.calls[call] as unknown as [string, RequestInit])[1]
                .headers
        expect(headersOf(0)).toEqual({ 'X-Algo-API-Token': 'a'.repeat(64) })
        expect(headersOf(1)).toEqual({})
    })

    it('returns a uint64 above 2^53 as a string and an empty body as undefined', async () => {
        respondWith(jsonResponse('{"amount": 18446744073709551615}'))
        await expect(fetchNodeJson(MAINNET, 'algod', '/v2/x')).resolves.toEqual(
            {
                amount: '18446744073709551615',
            },
        )

        respondWith(jsonResponse('  '))
        await expect(
            fetchNodeJson(MAINNET, 'algod', '/v2/x'),
        ).resolves.toBeUndefined()
    })

    it.each([
        [503, 'server'],
        [404, 'client'],
    ] as const)(
        'maps a %i to a %s PeraNetworkError carrying the status',
        async (status, kind) => {
            respondWith(jsonResponse('{"message":"nope"}', status))

            const error = await fetchNodeJson(MAINNET, 'algod', '/v2/x').catch(
                (e: unknown) => e,
            )

            expect(error).toBeInstanceOf(PeraNetworkError)
            expect(error).toMatchObject({ kind, status })
        },
    )

    it('maps a timeout to a timeout PeraNetworkError', async () => {
        setAlgorandChainContext({
            ...testChainContext(),
            timeouts: { readMs: 20, submitMs: 20 },
        })
        hangUntilAborted()

        await expect(
            fetchNodeJson(MAINNET, 'algod', '/v2/x'),
        ).rejects.toMatchObject({ kind: 'timeout' })
    })

    it.each(['Network request failed', 'Failed to fetch'])(
        'maps a network failure (%s) to an offline PeraNetworkError',
        async message => {
            respondWith(() => Promise.reject(new TypeError(message)))

            await expect(
                fetchNodeJson(MAINNET, 'algod', '/v2/x'),
            ).rejects.toMatchObject({ kind: 'offline' })
        },
    )

    it('warns on a retryable failure, which the query error handler leaves unlogged', async () => {
        const warn = vi.spyOn(logger, 'warn')
        respondWith(jsonResponse('{"message":"nope"}', 503))

        await fetchNodeJson(MAINNET, 'indexer', '/v2/x').catch(() => {})

        expect(warn).toHaveBeenCalledWith(
            'Node request did not complete',
            expect.objectContaining({ kind: 'server', status: 503 }),
        )
    })

    it('does not warn on a 4xx, which the query error handler reports itself', async () => {
        const warn = vi.spyOn(logger, 'warn')
        respondWith(jsonResponse('{"message":"nope"}', 404))

        await fetchNodeJson(MAINNET, 'indexer', '/v2/x').catch(() => {})

        expect(warn).not.toHaveBeenCalled()
    })

    it("rethrows a caller's abort as an AbortError, not a PeraNetworkError", async () => {
        hangUntilAborted()
        const caller = new AbortController()

        const promise = fetchNodeJson(MAINNET, 'algod', '/v2/x', {
            signal: caller.signal,
        })
        caller.abort()

        const error = await promise.catch((e: unknown) => e)
        expect(error).not.toBeInstanceOf(PeraNetworkError)
        expect(error).toMatchObject({ name: 'AbortError' })
    })

    it('uses a saved custom node on the next call, with no reset step', async () => {
        const fetchMock = respondWith(jsonResponse('{}'))
        setCustomNetwork({
            algodUrl: 'http://10.0.0.5:4001',
            indexerUrl: 'http://10.0.0.5:8980',
            genesisHash: 'HASH',
            genesisId: 'dockernet-v1',
        })

        await fetchNodeJson(Networks.custom, 'algod', '/v2/status')

        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            'http://10.0.0.5:4001/v2/status',
        )
    })
})
