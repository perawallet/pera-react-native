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

const { baanxDirectRequest, escrowRequest, queryClient } = vi.hoisted(() => ({
    baanxDirectRequest: vi.fn(),
    escrowRequest: vi.fn(),
    queryClient: vi.fn(),
}))

vi.mock('ky', () => ({
    isHTTPError: (error: unknown): boolean =>
        typeof error === 'object' && error !== null && 'response' in error,
}))
vi.mock('../baanx-client', () => ({ baanxDirectRequest }))
vi.mock('../escrow-client', () => ({ escrowRequest }))
vi.mock('@perawallet/wallet-core-shared', () => ({ queryClient }))

import { defaultTransport, setRefreshHandler } from '../default-transport'

const ok = { data: { ok: true }, status: 200, statusText: 'OK' }
const unauthorized = { response: { status: 401 } }

describe('defaultTransport', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setRefreshHandler(null)
    })

    it('routes direct requests to the Baanx client', async () => {
        baanxDirectRequest.mockResolvedValue(ok)

        const res = await defaultTransport.request({
            network: 'mainnet',
            method: 'GET',
            path: '/v1/card/status',
        })

        expect(res).toEqual(ok)
        expect(baanxDirectRequest).toHaveBeenCalledTimes(1)
        expect(queryClient).not.toHaveBeenCalled()
    })

    it('routes proxy requests through the pera backend', async () => {
        queryClient.mockResolvedValue(ok)

        await defaultTransport.request({
            route: 'proxy',
            network: 'testnet',
            method: 'POST',
            path: '/v1/auth/oauth/token',
            data: { grant_type: 'refresh_token' },
        })

        expect(queryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                backend: 'pera',
                url: '/v1/auth/oauth/token',
                method: 'POST',
            }),
        )
        expect(baanxDirectRequest).not.toHaveBeenCalled()
    })

    it('refreshes once and retries on a 401 for direct calls', async () => {
        baanxDirectRequest
            .mockRejectedValueOnce(unauthorized)
            .mockResolvedValueOnce(ok)
        const refresh = vi.fn().mockResolvedValue(true)
        setRefreshHandler(refresh)

        const res = await defaultTransport.request({
            network: 'mainnet',
            method: 'GET',
            path: '/v1/card/status',
        })

        expect(res).toEqual(ok)
        expect(refresh).toHaveBeenCalledTimes(1)
        expect(baanxDirectRequest).toHaveBeenCalledTimes(2)
    })

    it('surfaces the 401 when refresh cannot produce a token', async () => {
        baanxDirectRequest.mockRejectedValue(unauthorized)
        const refresh = vi.fn().mockResolvedValue(false)
        setRefreshHandler(refresh)

        await expect(
            defaultTransport.request({
                network: 'mainnet',
                method: 'GET',
                path: '/v1/card/status',
            }),
        ).rejects.toBe(unauthorized)
        expect(refresh).toHaveBeenCalledTimes(1)
        expect(baanxDirectRequest).toHaveBeenCalledTimes(1)
    })

    it('routes escrow requests to the AB escrow client', async () => {
        escrowRequest.mockResolvedValue(ok)

        const res = await defaultTransport.request({
            route: 'escrow',
            network: 'testnet',
            method: 'POST',
            path: '/api/approvals',
            data: { address: 'ADDR' },
        })

        expect(res).toEqual(ok)
        expect(escrowRequest).toHaveBeenCalledTimes(1)
        expect(baanxDirectRequest).not.toHaveBeenCalled()
        expect(queryClient).not.toHaveBeenCalled()
    })

    it('does not refresh on an escrow 401', async () => {
        escrowRequest.mockRejectedValue(unauthorized)
        const refresh = vi.fn().mockResolvedValue(true)
        setRefreshHandler(refresh)

        await expect(
            defaultTransport.request({
                route: 'escrow',
                network: 'mainnet',
                method: 'POST',
                path: '/api/approvals',
            }),
        ).rejects.toBe(unauthorized)
        expect(refresh).not.toHaveBeenCalled()
        expect(escrowRequest).toHaveBeenCalledTimes(1)
    })

    it('does not refresh on a proxy 401', async () => {
        queryClient.mockRejectedValue(unauthorized)
        const refresh = vi.fn().mockResolvedValue(true)
        setRefreshHandler(refresh)

        await expect(
            defaultTransport.request({
                route: 'proxy',
                network: 'mainnet',
                method: 'POST',
                path: '/v1/auth/oauth/token',
            }),
        ).rejects.toBe(unauthorized)
        expect(refresh).not.toHaveBeenCalled()
    })

    it('does not retry a 401 when no refresh handler is set', async () => {
        baanxDirectRequest.mockRejectedValue(unauthorized)

        await expect(
            defaultTransport.request({
                network: 'mainnet',
                method: 'GET',
                path: '/v1/card/status',
            }),
        ).rejects.toBe(unauthorized)
        expect(baanxDirectRequest).toHaveBeenCalledTimes(1)
    })
})
