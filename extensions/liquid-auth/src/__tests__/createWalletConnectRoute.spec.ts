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
import { createWalletConnectRoute } from '../walletconnect/createWalletConnectRoute'
import { Arc0027Error } from '../arc0027/errors'
import { ARC0027_ERROR_CODES } from '../arc0027/types'

const wcFrame = (method: string, params: unknown[], id: number | string = 1) =>
    JSON.stringify({ id, jsonrpc: '2.0', method, params })

const makeRoute = (overrides = {}) =>
    createWalletConnectRoute({
        signTransactions: vi.fn().mockResolvedValue({ stxns: ['c3R4bg=='] }),
        signMessage: vi.fn().mockResolvedValue({ signature: 'c2ln' }),
        account: 'ADDR1',
        genesisHash: 'gh',
        genesisId: 'mainnet-v1.0',
        ...overrides,
    })

describe('createWalletConnectRoute', () => {
    it('algo_signTxn → arc0027 sign_transactions envelope, replies with stxns', async () => {
        const signTransactions = vi
            .fn()
            .mockResolvedValue({ stxns: ['SIGNED'] })
        const route = makeRoute({ signTransactions })
        const out = JSON.parse(
            (await route(
                wcFrame('algo_signTxn', [[{ txn: 'u' }]], 9),
            )) as string,
        )
        expect(signTransactions).toHaveBeenCalledWith(
            expect.objectContaining({
                reference: 'arc0027:sign_transactions:request',
                params: { txns: [{ txn: 'u' }] },
            }),
        )
        expect(out).toEqual({ id: 9, jsonrpc: '2.0', result: ['SIGNED'] })
    })

    it('algo_signData → arc0027 sign_message, replies with the signature', async () => {
        const signMessage = vi.fn().mockResolvedValue({ signature: 'SIG' })
        const route = makeRoute({ signMessage })
        const out = JSON.parse(
            (await route(
                wcFrame('algo_signData', [{ data: 'd', signer: 'ADDR1' }], 3),
            )) as string,
        )
        expect(signMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                reference: 'arc0027:sign_message:request',
                params: { data: 'd', signer: 'ADDR1' },
            }),
        )
        expect(out).toEqual({ id: 3, jsonrpc: '2.0', result: 'SIG' })
    })

    it('session_request auto-approves with the bound account', async () => {
        const route = makeRoute()
        const out = JSON.parse(
            (await route(wcFrame('session_request', [], 2))) as string,
        )
        expect(out).toEqual({
            id: 2,
            jsonrpc: '2.0',
            result: {
                accounts: ['ADDR1'],
                genesisHash: 'gh',
                genesisId: 'mainnet-v1.0',
            },
        })
    })

    it('maps a user-reject (Arc0027Error 4001) to a WC 4001 error', async () => {
        const signTransactions = vi
            .fn()
            .mockRejectedValue(
                new Arc0027Error(
                    ARC0027_ERROR_CODES.MethodCanceledError,
                    'user rejected',
                ),
            )
        const route = makeRoute({ signTransactions })
        const out = JSON.parse(
            (await route(
                wcFrame('algo_signTxn', [[{ txn: 'u' }]], 4),
            )) as string,
        )
        expect(out.error).toEqual({ code: 4001, message: 'user rejected' })
    })

    it('replies with a 4000 error for an unsupported method', async () => {
        const route = makeRoute()
        const out = JSON.parse(
            (await route(wcFrame('algo_getAccounts', [], 7))) as string,
        )
        expect(out.error.code).toBe(4000)
    })

    it('returns null for a non-WC frame', async () => {
        const route = makeRoute()
        expect(
            await route(
                JSON.stringify({ reference: 'liquidauth:negotiate:offer' }),
            ),
        ).toBeNull()
    })
})
