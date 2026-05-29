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
import {
    createPostTransactionsHandler,
    createSignAndPostTransactionsHandler,
} from '../handlers/postTransactions'

describe('post_transactions handler', () => {
    it('submits stxns and returns the txn ids', async () => {
        const submit = vi.fn().mockResolvedValue(['TXID1'])
        const handler = createPostTransactionsHandler({ submit })
        const result = await handler({
            id: 'r',
            reference: 'arc0027:post_transactions:request',
            params: { stxns: ['c3R4bg=='] },
        })
        expect(submit).toHaveBeenCalledWith(['c3R4bg=='])
        expect(result).toEqual({ txnIds: ['TXID1'] })
    })

    it('maps a submit failure to FailedToPostSomeTransactionsError', async () => {
        const submit = vi.fn().mockRejectedValue(new Error('algod 400'))
        const handler = createPostTransactionsHandler({ submit })
        await expect(
            handler({
                id: 'r',
                reference: 'arc0027:post_transactions:request',
                params: { stxns: ['x'] },
            }),
        ).rejects.toMatchObject({ code: 4300 })
    })
})

describe('sign_and_post_transactions handler', () => {
    it('signs then posts, returning txn ids', async () => {
        const sign = vi.fn().mockResolvedValue({ stxns: ['signedb64', null] })
        const submit = vi.fn().mockResolvedValue(['TXID2'])
        const handler = createSignAndPostTransactionsHandler({ sign, submit })
        const result = await handler({
            id: 'r',
            reference: 'arc0027:sign_and_post_transactions:request',
            params: { txns: [{ txn: 'u' }] },
        })
        expect(submit).toHaveBeenCalledWith(['signedb64'])
        expect(result).toEqual({ txnIds: ['TXID2'] })
    })
})
