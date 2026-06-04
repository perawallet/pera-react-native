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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { kyCreate, clientCall, hasSecret, withSecret } = vi.hoisted(() => ({
    kyCreate: vi.fn(),
    clientCall: vi.fn(),
    hasSecret: vi.fn(),
    withSecret: vi.fn(),
}))

vi.mock('ky', () => ({ default: { create: kyCreate } }))
vi.mock('@perawallet/wallet-core-config', () => ({
    getNetworkConfig: () => ({
        baanxBaseUrl: 'https://baanx.test',
        baanxClientKey: 'CK_TEST',
    }),
}))
vi.mock('@perawallet/wallet-core-kms', () => ({ hasSecret, withSecret }))

import { baanxDirectRequest, resetBaanxClients } from '../baanx-client'

type FakeRequest = { headers: Headers }

const fakeJsonResponse = (body: unknown, status = 200) => ({
    status,
    statusText: 'OK',
    text: async () => JSON.stringify(body),
})

describe('baanxDirectRequest', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetBaanxClients()
        kyCreate.mockReturnValue(clientCall)
        clientCall.mockResolvedValue(fakeJsonResponse({ ok: true }))
        hasSecret.mockReturnValue(false)
        // withSecret runs the handler with the decoded token bytes.
        withSecret.mockImplementation(
            (_id: string, handler: (b: Uint8Array) => unknown) =>
                Promise.resolve(
                    handler(new TextEncoder().encode('ACCESS_TOKEN')),
                ),
        )
    })

    it('creates a client prefixed with the network Baanx base URL', async () => {
        await baanxDirectRequest({
            network: 'mainnet',
            method: 'GET',
            path: '/v1/card/status',
        })

        expect(kyCreate).toHaveBeenCalledWith(
            expect.objectContaining({ prefix: 'https://baanx.test' }),
        )
    })

    it('attaches x-client-key (not Authorization) in the client beforeRequest hook', async () => {
        await baanxDirectRequest({
            network: 'mainnet',
            method: 'GET',
            path: '/v1/card/status',
        })

        const hook = kyCreate.mock.calls[0][0].hooks.beforeRequest[0]
        const request: FakeRequest = { headers: new Headers() }
        hook({ request })

        expect(request.headers.get('x-client-key')).toBe('CK_TEST')
        expect(request.headers.get('Authorization')).toBeNull()
    })

    it('reads the access token from the keystore and attaches it per request', async () => {
        hasSecret.mockReturnValue(true)

        await baanxDirectRequest({
            network: 'mainnet',
            method: 'GET',
            path: '/v1/card/status',
        })

        expect(withSecret).toHaveBeenCalledWith(
            'baanx-access-token',
            expect.any(Function),
        )
        expect(clientCall).toHaveBeenCalledWith(
            'v1/card/status',
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer ACCESS_TOKEN',
                }),
            }),
        )
    })

    it('sends pre-auth requests without a Bearer when no token is stored', async () => {
        hasSecret.mockReturnValue(false)

        await baanxDirectRequest({
            network: 'mainnet',
            method: 'POST',
            path: '/v1/auth/login',
            data: { email: 'e@x.com' },
        })

        expect(withSecret).not.toHaveBeenCalled()
        const options = clientCall.mock.calls[0][1]
        expect(options.headers.Authorization).toBeUndefined()
    })

    it('parses a JSON response into the transport response shape', async () => {
        clientCall.mockResolvedValue(fakeJsonResponse({ id: 'card_1' }))

        const res = await baanxDirectRequest({
            network: 'mainnet',
            method: 'GET',
            path: '/v1/card/status',
        })

        expect(res).toEqual({
            data: { id: 'card_1' },
            status: 200,
            statusText: 'OK',
        })
    })

    it('reads a blob response when requested', async () => {
        clientCall.mockResolvedValue({
            status: 200,
            statusText: 'OK',
            blob: async () => new Blob(['csv']),
        })

        const res = await baanxDirectRequest({
            network: 'mainnet',
            method: 'GET',
            path: '/v1/card/transactions/statement',
            responseType: 'blob',
        })

        expect(res.data).toBeInstanceOf(Blob)
    })
})
