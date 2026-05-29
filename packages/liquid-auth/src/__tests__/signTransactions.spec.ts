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

import { describe, it, expect, vi } from 'vitest'
import { createSignTransactionsHandler } from '../handlers/signTransactions'
import { Arc0027Error } from '../arc0027/errors'

describe('sign_transactions handler', () => {
    it('resolves the group, enqueues it, and returns stxns on approve', async () => {
        const resolved = { toSign: [{ index: 0 }] } as never
        const resolve = vi.fn().mockReturnValue(resolved)
        const enqueue = vi.fn((_resolved, transport) => {
            transport.respondWithResult(['c3R4bg==', null])
        })

        const handler = createSignTransactionsHandler({
            resolve,
            enqueue,
            authorizedAddresses: new Set(['ADDR1']),
            transportId: 'session-1',
            sourceMetadata: { name: 'dApp' },
        })

        const result = await handler({
            id: 'r',
            reference: 'arc0027:sign_transactions:request',
            params: { txns: [{ txn: 'base64unsigned' }] },
        })

        expect(resolve).toHaveBeenCalledWith(
            { transactions: [{ txn: 'base64unsigned' }] },
            { authorizedAddresses: new Set(['ADDR1']) },
        )
        const transportArg = enqueue.mock.calls[0][1]
        expect(transportArg.sourceType).toBe('liquidauth')
        expect(transportArg.transportId).toBe('session-1')
        expect(result).toEqual({ stxns: ['c3R4bg==', null] })
    })

    it('rejects with MethodCanceledError when the pipeline rejects', async () => {
        const enqueue = vi.fn((_r, transport) => transport.respondWithReject())
        const handler = createSignTransactionsHandler({
            resolve: vi.fn().mockReturnValue({}),
            enqueue,
            authorizedAddresses: new Set(),
            transportId: 's',
        })
        await expect(
            handler({
                id: 'r',
                reference: 'arc0027:sign_transactions:request',
                params: { txns: [] },
            }),
        ).rejects.toBeInstanceOf(Arc0027Error)
    })
})
