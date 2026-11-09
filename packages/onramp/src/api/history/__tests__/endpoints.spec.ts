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
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import { http, HttpResponse, type JsonBodyType } from 'msw'
import { setupServer } from 'msw/node'

import {
    ACCOUNT,
    ROUTER_ACCOUNT,
    SCOPE,
    historyItem,
    registerRouterChain,
} from '../../../__tests__/routerFixtures'
import { getRampHistory } from '../endpoints'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => registerRouterChain())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const serve = (pages: JsonBodyType[]): URLSearchParams[] => {
    const requests: URLSearchParams[] = []
    server.use(
        http.get('*/api/v4/swap/history/', ({ request }) => {
            requests.push(new URL(request.url).searchParams)
            return HttpResponse.json(pages[requests.length - 1] ?? pages.at(-1))
        }),
    )
    return requests
}

const swapItem = (id: string) =>
    historyItem({ order_id: id, funding_method: 'wallet_transaction' })

describe('getRampHistory', () => {
    it('asks by device id and the account CAIP-10 id', async () => {
        const requests = serve([{ next: null, results: [historyItem()] }])

        await getRampHistory(
            { deviceId: 'device-1', accountAddress: ACCOUNT, cursor: 'c1' },
            SCOPE,
        )

        expect(requests[0].get('device_id')).toBe('device-1')
        expect(requests[0].get('accounts')).toBe(ROUTER_ACCOUNT)
        expect(requests[0].get('limit')).toBe('50')
        expect(requests[0].get('cursor')).toBe('c1')
    })

    it('returns the next cursor with the page', async () => {
        serve([
            {
                next: 'https://x/api/v4/swap/history/?cursor=c2',
                results: [historyItem()],
            },
        ])

        const page = await getRampHistory(
            { deviceId: 'device-1', accountAddress: ACCOUNT },
            SCOPE,
        )

        expect(page.cursor).toBe('c2')
        expect(page.results).toHaveLength(1)
    })

    it('renders a legacy row with null fields instead of dropping it', async () => {
        serve([
            {
                next: null,
                results: [
                    historyItem({
                        provider: null,
                        funding_method: null,
                        source_asset: null,
                        destination_asset: null,
                        source_amount: null,
                        destination_amount_expected: null,
                    }),
                ],
            },
        ])

        const page = await getRampHistory(
            { deviceId: 'device-1', accountAddress: ACCOUNT },
            SCOPE,
        )

        expect(page.results).toHaveLength(1)
        expect(page.results[0].sourceAmount).toBeNull()
    })

    it('drops Swap orders and follows next when the filter empties a page', async () => {
        const requests = serve([
            { next: 'c2', results: [swapItem('s1')] },
            {
                next: null,
                results: [swapItem('s2'), historyItem({ order_id: 'f1' })],
            },
        ])

        const page = await getRampHistory(
            { deviceId: 'device-1', accountAddress: ACCOUNT },
            SCOPE,
        )

        expect(page.results.map(item => item.id)).toEqual(['f1'])
        expect(requests.map(params => params.get('cursor'))).toEqual([
            null,
            'c2',
        ])
    })

    it('gives up after five requests that all came back empty', async () => {
        const requests = serve([{ next: 'more', results: [swapItem('s1')] }])

        const page = await getRampHistory(
            { deviceId: 'device-1', accountAddress: ACCOUNT },
            SCOPE,
        )

        expect(requests).toHaveLength(5)
        expect(page.results).toEqual([])
        expect(page.cursor).toBe('more')
    })

    it('keeps expired and refunded orders', async () => {
        serve([
            {
                next: null,
                results: [
                    historyItem({ order_id: 'e', status: 'expired' }),
                    historyItem({ order_id: 'r', status: 'refunded' }),
                ],
            },
        ])

        const page = await getRampHistory(
            { deviceId: 'device-1', accountAddress: ACCOUNT },
            SCOPE,
        )

        expect(page.results.map(item => item.status)).toEqual([
            'expired',
            'refunded',
        ])
    })
})
