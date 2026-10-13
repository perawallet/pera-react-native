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

// @vitest-environment node
import { afterAll, afterEach, beforeAll } from 'vitest'
import { generateAccount } from 'algosdk'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { broadcasterContractTests } from '@perawallet/wallet-core-signing/testing'
import {
    mockAlgodPendingTransaction,
    mockAlgodSendRawTransaction,
    mockAlgodStatus,
    mockAlgodStatusAfterBlock,
} from '../../test-handlers'
import { algorandBroadcasterAdapter } from '../broadcaster'
import { makeTestAddress, makeTestPaymentTx } from './transactions'

const SENDER = generateAccount()
const TXN = makeTestPaymentTx(SENDER.addr, {
    receiver: makeTestAddress(2),
    amount: 1n,
})
const TX_ID = TXN.txID()

const OVERSPEND =
    `TransactionPool.Remember: transaction ${TX_ID}: ` +
    `overspend (account ${SENDER.addr.toString()}, data {AccountBaseData:{Status:Offline ` +
    `MicroAlgos:{Raw:0}}}, tried to spend {1001})`

const nodeAnswers = (message: string) =>
    http.post('*/v2/transactions', () =>
        HttpResponse.json({ message }, { status: 400 }),
    )

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

broadcasterContractTests(() => algorandBroadcasterAdapter, {
    scope: scopeForLegacyNetwork('testnet'),
    signedTransactions: [TXN.signTxn(SENDER.sk)],
    txIds: [TX_ID],
    arrangeAccepted: () => {
        server.use(mockAlgodSendRawTransaction({ txId: TX_ID }))
    },
    arrangeAlreadyKnown: () => {
        server.use(nodeAnswers(`transaction already in ledger: ${TX_ID}`))
    },
    arrangeRejected: () => {
        server.use(nodeAnswers(OVERSPEND))
    },
    arrangeUnreachable: () => {
        server.use(http.post('*/v2/transactions', () => HttpResponse.error()))
    },
    arrangeConfirmed: () => {
        server.use(
            mockAlgodStatus(),
            mockAlgodStatusAfterBlock(),
            mockAlgodPendingTransaction({
                txId: TX_ID,
                status: 200,
                response: { 'confirmed-round': 5 },
            }),
        )
    },
    arrangeNeverConfirmed: () => {
        server.use(
            mockAlgodStatus(),
            mockAlgodStatusAfterBlock(),
            mockAlgodPendingTransaction(),
        )
    },
})
