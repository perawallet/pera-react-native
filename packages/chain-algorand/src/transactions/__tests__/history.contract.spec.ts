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

import { afterAll, afterEach, beforeAll } from 'vitest'
import { generateAccount } from 'algosdk'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import {
    type AssetRef,
    type ChainId,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { historyContractTests } from '@perawallet/wallet-core-transactions/testing'
import { algorandHistoryAdapter } from '../adapter'

const ADDRESS = generateAccount().addr.toString()
const COUNTERPARTY = generateAccount().addr.toString()
const ALGO: AssetRef = { chainId: 'algorand' as ChainId, assetId: '0' }

const row = (id: string, sender: string, receiver: string) => ({
    id,
    tx_type: 'pay',
    sender,
    receiver,
    confirmed_round: 100,
    round_time: 1_700_000_000,
    fee: '1000',
    amount: '500000',
})

const NEXT_URL = `https://mainnet.api.perawallet.app/v1/accounts/${ADDRESS}/transactions/?cursor=2`

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const serve = (first: object, second: object) =>
    server.use(
        http.get('*/v1/accounts/:address/transactions/', ({ request }) =>
            HttpResponse.json(
                new URL(request.url).searchParams.has('cursor')
                    ? second
                    : first,
            ),
        ),
    )

historyContractTests(() => algorandHistoryAdapter, {
    scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
    address: ADDRESS,
    nativeAsset: ALGO,
    arrangeTwoPages: () =>
        serve(
            {
                current_round: 200,
                next: NEXT_URL,
                results: [
                    row('TX1', ADDRESS, COUNTERPARTY),
                    row('TX2', COUNTERPARTY, ADDRESS),
                ],
            },
            {
                current_round: 200,
                next: null,
                results: [row('TX3', ADDRESS, COUNTERPARTY)],
            },
        ),
    arrangeEmpty: () =>
        serve(
            { current_round: 200, next: null, results: [] },
            { current_round: 200, next: null, results: [] },
        ),
})
