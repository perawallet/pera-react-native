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

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../../transport', () => ({ getCardTransport: () => ({ request }) }))

import {
    fetchDelegationToken,
    fetchExternalWallets,
    postAlgorandDelegationApproval,
    postDelegatorLsig,
} from '../endpoints'

const signData = { data: 'ZGF0YQ==', authenticatorData: 'YXV0aA==' }

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
        network: 'testnet' as const,
        address: 'FUNDINGADDR',
        currency: 'usdc',
        txId: 'TX123',
        signData,
        signature: 'c2ln',
        token: 'ABC_tok',
    }

    it('POSTs the Baanx Algorand post-approval body on the direct route with the user Bearer', async () => {
        request.mockResolvedValue({ data: { success: true }, status: 201 })

        await postAlgorandDelegationApproval(params)

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                path: '/v1/delegation/algorand/post-approval',
                authenticated: true,
                data: {
                    address: 'FUNDINGADDR',
                    network: 'algorand',
                    currency: 'usdc',
                    amount: '0',
                    txHash: 'TX123',
                    sigData: signData,
                    sigHash: 'c2ln',
                    token: 'ABC_tok',
                },
            }),
        )
        expect(request.mock.calls[0][0]).not.toHaveProperty('route')
    })

    it('rejects when Baanx answers success:false', async () => {
        request.mockResolvedValue({ data: { success: false }, status: 200 })

        await expect(postAlgorandDelegationApproval(params)).rejects.toThrow(
            'Card delegation was rejected',
        )
    })

    it('resolves when the service reports the wallet was already approved', async () => {
        request.mockRejectedValue({
            response: {
                status: 422,
                text: async () =>
                    JSON.stringify({ message: 'Wallet already approved' }),
            },
        })

        await expect(
            postAlgorandDelegationApproval(params),
        ).resolves.toBeUndefined()
    })

    it('rethrows any other approval failure', async () => {
        request.mockRejectedValue({
            response: {
                status: 422,
                text: async () =>
                    JSON.stringify({ message: 'Invalid signature' }),
            },
        })

        await expect(
            postAlgorandDelegationApproval(params),
        ).rejects.toBeTruthy()
    })
})

describe('postDelegatorLsig', () => {
    beforeEach(() => vi.clearAllMocks())

    const lsigParams = {
        network: 'testnet' as const,
        currency: 'usdc',
        delegatorAddress: 'FUNDING_ADDR',
        lsigBytes: 'bHNpZw==',
        cardAddress: 'ESCROW_CARD',
    }

    it('POSTs the LSig to the Baanx delegator-lsig path with the user Bearer', async () => {
        request.mockResolvedValue({ data: { success: true }, status: 201 })

        await postDelegatorLsig(lsigParams)

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                path: '/v1/delegation/algorand/delegator-lsig',
                authenticated: true,
                data: {
                    currency: 'usdc',
                    delegatorAddress: 'FUNDING_ADDR',
                    lsigBytes: 'bHNpZw==',
                    cardAddress: 'ESCROW_CARD',
                    blockchain: 'algorand',
                },
            }),
        )
        expect(request.mock.calls[0][0]).not.toHaveProperty('route')
    })

    it('rejects an LSig registration Baanx did not accept', async () => {
        request.mockResolvedValue({ data: { success: false }, status: 200 })

        await expect(postDelegatorLsig(lsigParams)).rejects.toThrow(
            'Card delegation was rejected',
        )
    })

    it('accepts a 2xx whose body carries no success flag', async () => {
        // The delegation service answers some calls with a bare status line.
        // Treating an unreadable 2xx as a failure would strand a registration
        // that already succeeded.
        for (const data of ['Created', undefined, null, 42]) {
            request.mockResolvedValue({ data, status: 201 })
            await expect(postDelegatorLsig(lsigParams)).resolves.toBeUndefined()
        }
    })
})
