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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { startFixtureNetwork, type FixtureNetwork } from '../fixtureNetwork'

describe('startFixtureNetwork', () => {
    const realFetch = globalThis.fetch
    let network: FixtureNetwork

    beforeEach(() => {
        network = startFixtureNetwork()
    })

    afterEach(() => {
        globalThis.fetch = realFetch
    })

    it('hands the app the handler response itself, never one rebuilt from its body stream', async () => {
        let served: Response | undefined
        network.use(
            http.get('*/v1/assets/', () => {
                served = HttpResponse.json({ results: [{ asset_id: '1' }] })
                return served
            }),
        )

        const response = await fetch('https://backend.test/v1/assets/')

        expect(response).toBe(served)
        expect(await response.json()).toEqual({ results: [{ asset_id: '1' }] })
        expect(network.requestCount()).toBe(1)
    })

    it('lets a later handler override an earlier one for the same request', async () => {
        network.use(http.get('*/flag', () => HttpResponse.json(false)))
        network.use(http.get('*/flag', () => HttpResponse.json(true)))

        const response = await fetch('https://backend.test/flag')

        expect(await response.json()).toBe(true)
    })

    it('refuses and records a request no handler answers, and reset clears it all', async () => {
        await expect(fetch('https://backend.test/missing')).rejects.toThrow(
            TypeError,
        )
        expect(network.unhandledRequests()).toEqual([
            'GET https://backend.test/missing',
        ])

        network.reset()

        expect(network.requestCount()).toBe(0)
        expect(network.unhandledRequests()).toEqual([])
    })
})
