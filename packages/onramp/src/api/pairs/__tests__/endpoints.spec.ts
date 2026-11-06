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
import { http, HttpResponse, type JsonBodyType } from 'msw'
import { setupServer } from 'msw/node'

import {
    COIN_ID,
    FIAT_ID,
    NATIVE_ID,
    SCOPE,
    STABLE_ID,
    coinAsset,
    fiatAsset,
    nativeAsset,
    pairRow,
    stableAsset,
} from '../../../__tests__/routerFixtures'
import { getRampDestinations, getRampSources } from '../endpoints'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const serve = (pages: JsonBodyType[]): URLSearchParams[] => {
    const requests: URLSearchParams[] = []
    server.use(
        http.get('*/api/v4/swap/pairs/', ({ request }) => {
            const params = new URL(request.url).searchParams
            requests.push(params)
            return HttpResponse.json(pages[requests.length - 1] ?? pages.at(-1))
        }),
    )
    return requests
}

describe('getRampDestinations', () => {
    it('asks for non-signable pairs with no destination', async () => {
        const requests = serve([{ next: null, results: [] }])

        await getRampDestinations(SCOPE)

        expect(requests).toHaveLength(1)
        expect(requests[0].get('signable')).toBe('false')
        expect(requests[0].get('limit')).toBe('50')
        expect(requests[0].has('destination')).toBe(false)
    })

    it('follows a short or empty page that has a next cursor', async () => {
        const requests = serve([
            { next: 'https://x/api/v4/swap/pairs/?cursor=c2', results: [] },
            {
                next: 'c3',
                results: [pairRow(nativeAsset())],
            },
            { next: null, results: [pairRow(stableAsset())] },
        ])

        const tokens = await getRampDestinations(SCOPE)

        expect(tokens.map(token => token.id)).toEqual([NATIVE_ID, STABLE_ID])
        expect(requests.map(params => params.get('cursor'))).toEqual([
            null,
            'c2',
            'c3',
        ])
    })

    it('skips a malformed row and keeps the rest', async () => {
        serve([
            {
                next: null,
                results: [{ asset: { name: 'no id' } }, pairRow(nativeAsset())],
            },
        ])

        const tokens = await getRampDestinations(SCOPE)

        expect(tokens.map(token => token.id)).toEqual([NATIVE_ID])
    })

    it('stops after 20 pages', async () => {
        const requests = serve([
            { next: 'more', results: [pairRow(nativeAsset())] },
        ])

        await getRampDestinations(SCOPE)

        expect(requests).toHaveLength(20)
    })
})

describe('getRampSources', () => {
    it('asks for the sources of one destination, non-signable', async () => {
        const requests = serve([{ next: null, results: [] }])

        await getRampSources(NATIVE_ID, SCOPE)

        expect(requests[0].get('destination')).toBe(NATIVE_ID)
        expect(requests[0].get('signable')).toBe('false')
    })

    it('keeps fiat and deposit rows and drops token rows', async () => {
        serve([
            {
                next: null,
                results: [
                    pairRow(stableAsset(), { kind: 'token' }),
                    pairRow(fiatAsset(), { kind: 'fiat' }),
                    pairRow(coinAsset(), { kind: 'deposit' }),
                ],
            },
        ])

        const tokens = await getRampSources(NATIVE_ID, SCOPE)

        expect(tokens.map(token => [token.id, token.kind])).toEqual([
            [FIAT_ID, 'fiat'],
            [COIN_ID, 'deposit'],
        ])
    })

    it('lists a coin offered by two aggregators once', async () => {
        serve([
            {
                next: null,
                results: [
                    pairRow(coinAsset(), { kind: 'deposit', aggregator: 'a' }),
                    pairRow(coinAsset(), { kind: 'deposit', aggregator: 'b' }),
                ],
            },
        ])

        const tokens = await getRampSources(NATIVE_ID, SCOPE)

        expect(tokens).toHaveLength(1)
    })
})
