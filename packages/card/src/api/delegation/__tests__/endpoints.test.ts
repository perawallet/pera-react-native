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

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../../transport', () => ({ getCardTransport: () => ({ request }) }))

import {
    fetchDelegationToken,
    fetchDelegationProgram,
    fetchExternalWallets,
    postAlgorandDelegationApproval,
} from '../endpoints'

describe('fetchDelegationToken', () => {
    beforeEach(() => vi.clearAllMocks())

    it('GETs /v1/delegation/token authenticated and returns the pair', async () => {
        request.mockResolvedValue({
            data: { token: 'tok-1', nonce: 'bm9uY2U=' },
        })

        const result = await fetchDelegationToken({ network: 'mainnet' })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                path: '/v1/delegation/token',
                authenticated: true,
            }),
        )
        expect(result).toEqual({ token: 'tok-1', nonce: 'bm9uY2U=' })
    })

    it('rejects on a malformed response', async () => {
        request.mockResolvedValue({ data: { token: 'tok-1' } })

        await expect(
            fetchDelegationToken({ network: 'mainnet' }),
        ).rejects.toThrow()
    })
})

describe('fetchDelegationProgram', () => {
    beforeEach(() => vi.clearAllMocks())

    it('GETs the algorand chain config and decodes the program bytes', async () => {
        // 'BIEB' = base64 of [0x04, 0x81, 0x01].
        request.mockResolvedValue({ data: { program: 'BIEB' } })

        const program = await fetchDelegationProgram({ network: 'mainnet' })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                path: '/v1/delegation/chain/config',
                params: { network: 'algorand' },
                authenticated: true,
            }),
        )
        expect([...program]).toEqual([0x04, 0x81, 0x01])
    })
})

describe('fetchExternalWallets', () => {
    beforeEach(() => vi.clearAllMocks())

    it('GETs /v1/wallet/external and transforms allowance/balance to Decimal', async () => {
        request.mockResolvedValue({
            data: [
                {
                    address: 'ALGO_ADDR',
                    currency: 'usdc',
                    balance: '10.25',
                    allowance: '400',
                    network: 'algorand',
                },
            ],
        })

        const wallets = await fetchExternalWallets({ network: 'mainnet' })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                path: '/v1/wallet/external',
                authenticated: true,
            }),
        )
        expect(wallets).toHaveLength(1)
        expect(wallets[0].allowance.toFixed()).toBe('400')
        expect(wallets[0].balance.toFixed(2)).toBe('10.25')
    })

    it('defaults absent monetary fields to zero', async () => {
        request.mockResolvedValue({
            data: [{ address: 'ALGO_ADDR', currency: 'usdc' }],
        })

        const wallets = await fetchExternalWallets({ network: 'mainnet' })

        expect(wallets[0].allowance.isZero()).toBe(true)
        expect(wallets[0].balance.isZero()).toBe(true)
    })
})

describe('postAlgorandDelegationApproval', () => {
    beforeEach(() => vi.clearAllMocks())

    const params = {
        network: 'mainnet' as const,
        address: 'ALGO_ADDR',
        amount: '400',
        currency: 'usdc',
        token: 'tok-1',
        signedProgram: 'c2lnbmVk',
        sigMessage: 'bm9uY2U=',
    }

    it('POSTs the assumed Algorand post-approval wire body', async () => {
        request.mockResolvedValue({ data: { success: true } })

        await postAlgorandDelegationApproval(params)

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                path: '/v1/delegation/algorand/post-approval',
                authenticated: true,
                data: {
                    address: 'ALGO_ADDR',
                    network: 'algorand',
                    currency: 'usdc',
                    amount: '400',
                    token: 'tok-1',
                    signedProgram: 'c2lnbmVk',
                    sigMessage: 'bm9uY2U=',
                },
            }),
        )
    })

    it('sends amount "0" untouched — the cancel wire format', async () => {
        request.mockResolvedValue({ data: { success: true } })

        await postAlgorandDelegationApproval({ ...params, amount: '0' })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ amount: '0' }),
            }),
        )
    })

    it('rejects when the API reports success=false', async () => {
        request.mockResolvedValue({ data: { success: false } })

        await expect(postAlgorandDelegationApproval(params)).rejects.toThrow(
            'Card delegation was rejected',
        )
    })
})
