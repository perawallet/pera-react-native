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

import { server } from '@test-utils/msw-server'
import { getAlgorandClient } from '@perawallet/wallet-core-blockchain'
import {
    mockAlgodAccountInformation,
    mockAlgodTransactionParams,
} from '@perawallet/wallet-core-blockchain/test-handlers'

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
            mockAlgodAccountInformation({
                address: TEST_ADDR,
                response: { amount: 12_345_678 },
            }),
        )

        const client = getAlgorandClient('mainnet')
        const info = await client.client.algod
            .accountInformation(TEST_ADDR)
            .do()
        expect(Number(info.amount)).toBe(12_345_678)
    })

    it('Given an MSW handler for transactionParams, when algokit fetches suggested params, then it returns the mocked round + fee', async () => {
        server.use(mockAlgodTransactionParams({ response: { fee: 0 } }))

        const client = getAlgorandClient('mainnet')
        const params = await client.client.algod.getTransactionParams().do()
        expect(Number(params.fee)).toBe(0)
    })
})
