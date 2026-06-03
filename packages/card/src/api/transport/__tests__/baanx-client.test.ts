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

const { kyCreate, clientCall } = vi.hoisted(() => ({
    kyCreate: vi.fn(),
    clientCall: vi.fn(),
}))

vi.mock('ky', () => ({ default: { create: kyCreate } }))
vi.mock('@perawallet/wallet-core-config', () => ({
    getNetworkConfig: () => ({
        baanxBaseUrl: 'https://baanx.test',
        baanxClientKey: 'CK_TEST',
    }),
}))

import { baanxDirectRequest, resetBaanxClients } from '../baanx-client'
import {
    setCachedAccessToken,
    clearTokenCache,
} from '../../../session/token-cache'

type FakeRequest = { headers: Headers }

const fakeJsonResponse = (body: unknown, status = 200) => ({
    status,
    statusText: 'OK',
    text: async () => JSON.stringify(body),
})

const firstBeforeRequestHook = (): ((state: {
    request: FakeRequest
}) => void) => kyCreate.mock.calls[0][0].hooks.beforeRequest[0]

describe('baanxDirectRequest', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetBaanxClients()
        clearTokenCache()
        kyCreate.mockReturnValue(clientCall)
    })

    it('creates a client prefixed with the network Baanx base URL', async () => {
        clientCall.mockResolvedValue(fakeJsonResponse({ ok: true }))

        await baanxDirectRequest({
            network: 'mainnet',
            method: 'GET',
            path: '/v1/card/status',
        })

        expect(kyCreate).toHaveBeenCalledWith(
            expect.objectContaining({ prefix: 'https://baanx.test' }),
        )
    })

    it('strips the leading slash from the path', async () => {
        clientCall.mockResolvedValue(fakeJsonResponse({ ok: true }))

        await baanxDirectRequest({
            network: 'mainnet',
            method: 'GET',
            path: '/v1/card/status',
        })

        expect(clientCall).toHaveBeenCalledWith(
            'v1/card/status',
            expect.objectContaining({ method: 'GET' }),
        )
    })

    it('attaches x-client-key and the Bearer token via beforeRequest', async () => {
        setCachedAccessToken('ACCESS_TOKEN', Date.now() + 1_000)
        clientCall.mockResolvedValue(fakeJsonResponse({ ok: true }))

        await baanxDirectRequest({
            network: 'mainnet',
            method: 'GET',
            path: '/v1/card/status',
        })

        const request: FakeRequest = { headers: new Headers() }
        firstBeforeRequestHook()({ request })

        expect(request.headers.get('x-client-key')).toBe('CK_TEST')
        expect(request.headers.get('Authorization')).toBe('Bearer ACCESS_TOKEN')
    })

    it('omits the Bearer header when no token is cached', async () => {
        clientCall.mockResolvedValue(fakeJsonResponse({ ok: true }))

        await baanxDirectRequest({
            network: 'mainnet',
            method: 'GET',
            path: '/v1/card/status',
        })

        const request: FakeRequest = { headers: new Headers() }
        firstBeforeRequestHook()({ request })

        expect(request.headers.get('Authorization')).toBeNull()
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
})
