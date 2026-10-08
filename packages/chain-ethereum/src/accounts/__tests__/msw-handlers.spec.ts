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
import { unknownAssetItem } from '../../assets/api/msw-handlers'
import { peraEvmHandlers } from '../msw-handlers'

const PERA_URL = 'https://pera.test'
const USDC_CAIP19 = 'eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const post = async (path: string, body: unknown) => {
    const response = await fetch(`${PERA_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    return response.json()
}

describe('unknownAssetItem', () => {
    it('takes its type from the CAIP-19 namespace, as the backend does', () => {
        expect(unknownAssetItem(USDC_CAIP19).type).toBe('erc20')
        expect(unknownAssetItem('eip155:1/slip44:60').type).toBe('native')
    })
})

describe('peraEvmHandlers', () => {
    it('answers an asset id lowercased', async () => {
        server.use(...peraEvmHandlers({ baseUrl: PERA_URL }))

        const { results } = await post('/api/v4/assets/', {
            ids: [USDC_CAIP19.toUpperCase().replace('EIP155', 'eip155')],
        })

        expect(results[0].asset_id).toBe(USDC_CAIP19)
    })

    it('refreshes a never-synced cursor by default, with a round', async () => {
        server.use(...peraEvmHandlers({ baseUrl: PERA_URL }))

        const answer = await post('/api/v4/accounts/should-refresh/', {
            chain: 'eip155:1',
            account_addresses: ['0x00000000000000000000000000000000000000aa'],
            last_refreshed_round: null,
        })

        expect(answer).toEqual({ refresh: true, round: expect.any(Number) })
    })

    it('reports no refresh past a cursor by default', async () => {
        server.use(...peraEvmHandlers({ baseUrl: PERA_URL }))

        const answer = await post('/api/v4/accounts/should-refresh/', {
            chain: 'eip155:1',
            account_addresses: ['0x00000000000000000000000000000000000000aa'],
            last_refreshed_round: 40,
        })

        expect(answer).toEqual({ refresh: false })
    })
})
