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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { kyCreate, clientCall, getNetworkConfig } = vi.hoisted(() => ({
    kyCreate: vi.fn(),
    clientCall: vi.fn(),
    getNetworkConfig: vi.fn(),
}))

vi.mock('ky', () => ({ default: { create: kyCreate } }))
vi.mock('@perawallet/wallet-core-config', () => ({ getNetworkConfig }))

import {
    escrowRequest,
    resetEscrowClients,
    CardEscrowNotConfiguredError,
} from '../escrow-client'

type FakeRequest = { headers: Headers }

const fakeJsonResponse = (body: unknown, status = 200) => ({
    status,
    statusText: 'OK',
    text: async () => JSON.stringify(body),
})

describe('escrowRequest', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetEscrowClients()
        kyCreate.mockReturnValue(clientCall)
        clientCall.mockResolvedValue(fakeJsonResponse({ cardAddress: 'C1' }))
        getNetworkConfig.mockReturnValue({
            cardEscrowBaseUrl: 'https://escrow.test',
            cardEscrowAuthToken: 'TOKEN_ABC',
        })
    })

    it('creates a client prefixed with the network escrow base URL', async () => {
        await escrowRequest({
            network: 'testnet',
            route: 'escrow',
            method: 'POST',
            path: '/api/approvals',
            data: { address: 'ADDR' },
        })

        expect(kyCreate).toHaveBeenCalledWith(
            expect.objectContaining({ prefix: 'https://escrow.test' }),
        )
    })

    it('attaches the static token as a RAW Authorization header (no Bearer)', async () => {
        await escrowRequest({
            network: 'testnet',
            method: 'POST',
            path: '/api/approvals',
        })

        const hook = kyCreate.mock.calls[0][0].hooks.beforeRequest[0]
        const request: FakeRequest = { headers: new Headers() }
        hook({ request })

        expect(request.headers.get('Authorization')).toBe('TOKEN_ABC')
        expect(request.headers.get('Content-Type')).toBe('application/json')
    })

    it('omits Authorization when no token is configured', async () => {
        getNetworkConfig.mockReturnValue({
            cardEscrowBaseUrl: 'https://escrow.test',
            cardEscrowAuthToken: '',
        })

        await escrowRequest({
            network: 'testnet',
            method: 'POST',
            path: '/api/approvals',
        })

        const hook = kyCreate.mock.calls[0][0].hooks.beforeRequest[0]
        const request: FakeRequest = { headers: new Headers() }
        hook({ request })

        expect(request.headers.get('Authorization')).toBeNull()
    })

    it('throws CardEscrowNotConfiguredError when the base URL is empty', async () => {
        getNetworkConfig.mockReturnValue({
            cardEscrowBaseUrl: '',
            cardEscrowAuthToken: '',
        })

        await expect(
            escrowRequest({
                network: 'testnet',
                method: 'POST',
                path: '/api/approvals',
            }),
        ).rejects.toBeInstanceOf(CardEscrowNotConfiguredError)
        expect(kyCreate).not.toHaveBeenCalled()
    })

    it('parses a JSON response into the transport response shape', async () => {
        clientCall.mockResolvedValue(fakeJsonResponse({ cardAddress: 'ESC1' }))

        const res = await escrowRequest({
            network: 'testnet',
            method: 'POST',
            path: '/api/approvals',
        })

        expect(res).toEqual({
            data: { cardAddress: 'ESC1' },
            status: 200,
            statusText: 'OK',
        })
    })
})
