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

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { evmHistoryItem, peraEvmHistoryHandlers } from '../msw-handlers'
import { historyPath } from '../endpoints'

const BASE = 'https://pera.test'
const ME = '0x00000000000000000000000000000000000000aa'
const HEADERS = {
    'x-api-key': 'key',
    'x-app-integrity-token': 'token',
}
const first = evmHistoryItem({ hash: `0x${'a'.repeat(64)}` })
const second = evmHistoryItem({ hash: `0x${'b'.repeat(64)}` })

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const get = (
    query = '',
    address = ME,
    headers: Record<string, string> = HEADERS,
) => fetch(`${BASE}${historyPath(1, address)}${query}`, { headers })

describe('peraEvmHistoryHandlers', () => {
    it('answers 401 without an API key and 403 without an integrity token', async () => {
        server.use(
            ...peraEvmHistoryHandlers({
                baseUrl: BASE,
                history: { [ME]: [[first]] },
            }),
        )

        expect((await get('', ME, {})).status).toBe(401)
        expect((await get('', ME, { 'x-api-key': 'key' })).status).toBe(403)
    })

    it('serves the pages in order, each pointing at the next until the last', async () => {
        server.use(
            ...peraEvmHistoryHandlers({
                baseUrl: BASE,
                history: { [ME]: [[first], [second]] },
            }),
        )

        const page0 = await (await get()).json()
        const page1 = await (await get('?cursor=page:1')).json()

        expect(page0).toEqual({
            next: 'page:1',
            previous: null,
            results: [first],
        })
        expect(page1).toEqual({ next: null, previous: null, results: [second] })
    })

    it('answers an address with no fixture with an empty page', async () => {
        server.use(...peraEvmHistoryHandlers({ baseUrl: BASE }))

        await expect((await get()).json()).resolves.toEqual({
            next: null,
            previous: null,
            results: [],
        })
    })

    it('fails every read with a numeric fixture', async () => {
        server.use(...peraEvmHistoryHandlers({ baseUrl: BASE, history: 503 }))

        expect((await get()).status).toBe(503)
    })

    it('answers a cursor it never issued with 404 invalid_cursor', async () => {
        server.use(
            ...peraEvmHistoryHandlers({
                baseUrl: BASE,
                history: { [ME]: [[first]] },
            }),
        )

        for (const cursor of ['page:1', 'nonsense']) {
            const response = await get(`?cursor=${cursor}`)

            expect(response.status).toBe(404)
            await expect(response.json()).resolves.toEqual({
                error: 'Invalid cursor',
                code: 'invalid_cursor',
            })
        }
    })
})
