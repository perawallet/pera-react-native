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
    postDelegationApproval,
    postDelegatorLsig,
} from '../endpoints'
import { registerFakeCardAdapter } from '../../../__tests__/fakeCardAdapter'

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

describe('postDelegationApproval', () => {
    beforeEach(() => vi.clearAllMocks())

    const { network, ...approval } = {
        network: 'testnet' as const,
        address: 'FUNDINGADDR',
        currency: 'usdc',
        txId: 'TX123',
        signData,
        signature: 'c2ln',
        token: 'ABC_tok',
    }
    const params = { network, ...approval }

    it("POSTs the chain adapter's route and body on the direct route with the user Bearer", async () => {
        const adapter = registerFakeCardAdapter({
            delegationApprovalRequest: vi.fn(() => ({
                path: '/v1/delegation/chain/post-approval',
                data: { body: 'chain' },
            })),
        })
        request.mockResolvedValue({ data: { success: true }, status: 201 })

        await postDelegationApproval(params)

        expect(adapter.delegationApprovalRequest).toHaveBeenCalledWith(approval)
        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                network,
                method: 'POST',
                path: '/v1/delegation/chain/post-approval',
                authenticated: true,
                data: { body: 'chain' },
            }),
        )
        expect(request.mock.calls[0][0]).not.toHaveProperty('route')
    })

    it('rejects when Baanx answers success:false', async () => {
        registerFakeCardAdapter()
        request.mockResolvedValue({ data: { success: false }, status: 200 })

        await expect(postDelegationApproval(params)).rejects.toThrow(
            'Card delegation was rejected',
        )
    })

    it('resolves when the service reports the wallet was already approved', async () => {
        registerFakeCardAdapter()
        request.mockRejectedValue({
            response: {
                status: 422,
                text: async () =>
                    JSON.stringify({ message: 'Wallet already approved' }),
            },
        })

        await expect(postDelegationApproval(params)).resolves.toBeUndefined()
    })

    it('rethrows any other approval failure', async () => {
        registerFakeCardAdapter()
        request.mockRejectedValue({
            response: {
                status: 422,
                text: async () =>
                    JSON.stringify({ message: 'Invalid signature' }),
            },
        })

        await expect(postDelegationApproval(params)).rejects.toBeTruthy()
    })
})

describe('postDelegatorLsig', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registerFakeCardAdapter()
    })

    const lsigParams = {
        network: 'testnet' as const,
        currency: 'usdc',
        delegatorAddress: 'FUNDING_ADDR',
        lsigBytes: 'bHNpZw==',
        cardAddress: 'ESCROW_CARD',
    }

    it("POSTs the chain adapter's delegator route and body with the user Bearer", async () => {
        const adapter = registerFakeCardAdapter({
            delegatorProgramRequest: vi.fn(() => ({
                path: '/v1/delegation/chain/delegator-lsig',
                data: { body: 'chain' },
            })),
        })
        request.mockResolvedValue({ data: { success: true }, status: 201 })

        await postDelegatorLsig(lsigParams)

        expect(adapter.delegatorProgramRequest).toHaveBeenCalledWith({
            currency: 'usdc',
            delegatorAddress: 'FUNDING_ADDR',
            lsigBytes: 'bHNpZw==',
            cardAddress: 'ESCROW_CARD',
        })
        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                path: '/v1/delegation/chain/delegator-lsig',
                authenticated: true,
                data: { body: 'chain' },
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
