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
    describe,
    expect,
    test,
    vi,
} from 'vitest'
import { generateAccount } from 'algosdk'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { concatBytes } from '@perawallet/wallet-core-shared'
import { AlgodError } from '../../blockchain'
import {
    mockAlgodPendingTransaction,
    mockAlgodStatus,
    mockAlgodStatusAfterBlock,
} from '../../test-handlers'
import { makeTestAddress, makeTestPaymentTx } from './transactions'

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useNetworkStore: {
        getState: () => ({ network: 'testnet', customNetworksByChain: {} }),
        subscribe: () => () => {},
    },
}))

import { algorandBroadcasterAdapter } from '../broadcaster'

describe('algorandBroadcasterAdapter.submitTimeoutError', () => {
    test('is a retryable network_unavailable error naming the timeout', () => {
        const error = algorandBroadcasterAdapter.submitTimeoutError(5000)

        expect(error).toBeInstanceOf(AlgodError)
        expect((error as AlgodError).code).toBe('network_unavailable')
        expect(error.metadata.retryable).toBe(true)
        expect(error.originalError?.message).toContain('5000ms')
    })
})

describe('algorandBroadcasterAdapter submit and waitForConfirmation', () => {
    const scope = scopeForLegacyNetwork('testnet')
    const sender = generateAccount()
    const group = [1n, 2n].map(amount =>
        makeTestPaymentTx(sender.addr, {
            receiver: makeTestAddress(2),
            amount,
        }),
    )
    const signed = group.map(txn => txn.signTxn(sender.sk))
    const txIds = group.map(txn => txn.txID())

    const server = setupServer()
    beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    test('posts the signed bytes unchanged, concatenated in order', async () => {
        let posted: Uint8Array | undefined
        server.use(
            http.post('*/v2/transactions', async ({ request }) => {
                posted = new Uint8Array(await request.arrayBuffer())
                return HttpResponse.json({ txId: txIds[0] })
            }),
        )

        await algorandBroadcasterAdapter.submit(scope, signed)

        expect(posted).toEqual(concatBytes(...signed))
    })

    test('rejects the wait when the node drops the transaction from its pool', async () => {
        server.use(
            mockAlgodStatus(),
            mockAlgodStatusAfterBlock(),
            mockAlgodPendingTransaction({
                txId: txIds[0],
                status: 200,
                response: { 'pool-error': 'transaction evicted' },
            }),
        )

        await expect(
            algorandBroadcasterAdapter.waitForConfirmation(scope, txIds),
        ).rejects.toThrow('transaction evicted')
    })

    test('tracks a group by its first transaction', async () => {
        server.use(
            mockAlgodStatus(),
            mockAlgodStatusAfterBlock(),
            mockAlgodPendingTransaction({
                txId: txIds[0],
                status: 200,
                response: { 'confirmed-round': 5 },
            }),
        )

        await expect(
            algorandBroadcasterAdapter.waitForConfirmation(scope, txIds),
        ).resolves.toBeUndefined()
    })
})
