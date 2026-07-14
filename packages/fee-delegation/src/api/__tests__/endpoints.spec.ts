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

import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

import { requestFeeDelegation } from '../endpoints'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const REQUEST = {
    txnGroup: [{ txn: 'dW5zaWduZWQ=' }],
    account: 'TESTADDRESS',
    includeMbr: true,
    optInAssetIds: ['31566704'],
}

describe('fee-delegation/requestFeeDelegation', () => {
    test('POSTs the group with the integrity token header and parses the response', async () => {
        let token: string | null = null
        let body: unknown = null
        server.use(
            http.post('*/api/v3/fee-delegation', async ({ request }) => {
                token = request.headers.get('x-app-integrity-token')
                body = await request.json()
                return HttpResponse.json({
                    txnGroup: [
                        { txn: 'c3BvbnNvcg==', signers: [], stxn: 'c2lnbmVk' },
                        { txn: 'dW5zaWduZWQ=', signers: ['TESTADDRESS'] },
                    ],
                })
            }),
        )

        const result = await requestFeeDelegation(
            REQUEST,
            'token-123',
            'mainnet',
        )

        expect(token).toBe('token-123')
        expect(body).toEqual(REQUEST)
        expect(result.txnGroup).toHaveLength(2)
        expect(result.txnGroup[0]!.stxn).toBe('c2lnbmVk')
        expect(result.txnGroup[1]!.stxn).toBeUndefined()
    })

    test('rejects on a malformed response body', async () => {
        server.use(
            http.post('*/api/v3/fee-delegation', () =>
                HttpResponse.json({ group: ['legacy-shape'] }),
            ),
        )

        await expect(
            requestFeeDelegation(REQUEST, 'token-123', 'mainnet'),
        ).rejects.toThrow()
    })
})
