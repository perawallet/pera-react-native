/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { http, HttpResponse } from 'msw'

import { server } from '@test-utils/msw-server'
import { getAlgorandClient } from '@perawallet/wallet-core-blockchain'

// Smoke test answering the question: does MSW intercept the HTTP calls
// that algokit-utils makes? If yes, integration tests can mock algod/
// indexer responses with handler factories like everywhere else.

describe('algokit-utils + MSW interception', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    const TEST_ADDR =
        'CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA'

    it('Given an MSW handler for accountInformation, when algokit fetches account info, then the response is the mocked one', async () => {
        server.use(
            http.get(`*/v2/accounts/${TEST_ADDR}`, () =>
                HttpResponse.json({
                    address: TEST_ADDR,
                    amount: 12345678,
                    'min-balance': 100000,
                    'amount-without-pending-rewards': 12345678,
                    'pending-rewards': 0,
                    rewards: 0,
                    round: 1,
                    status: 'Offline',
                    assets: [],
                    'apps-local-state': [],
                    'apps-total-schema': { 'num-byte-slice': 0, 'num-uint': 0 },
                    'created-apps': [],
                    'created-assets': [],
                    'total-apps-opted-in': 0,
                    'total-assets-opted-in': 0,
                    'total-created-apps': 0,
                    'total-created-assets': 0,
                }),
            ),
        )

        const client = getAlgorandClient('mainnet')
        const info = await client.client.algod.accountInformation(TEST_ADDR)
        expect(Number(info.amount)).toBe(12345678)
    })

    it('Given an MSW handler for transactionParams, when algokit fetches suggested params, then it returns the mocked round + fee', async () => {
        server.use(
            http.get('*/v2/transactions/params', () =>
                HttpResponse.json({
                    'consensus-version':
                        'https://github.com/algorandfoundation/specs/tree/test',
                    fee: 0,
                    'min-fee': 1000,
                    'genesis-id': 'mainnet-v1.0',
                    'genesis-hash':
                        'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
                    'last-round': 99999,
                }),
            ),
        )

        const client = getAlgorandClient('mainnet')
        const params = await client.client.algod.transactionParams()
        expect(Number(params.fee)).toBe(0)
    })
})
