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
    postAutoDrawDelegation,
    postCardDelegation,
    postDelegationApproval,
} from '../endpoints'
import { AutoDrawDelegationRejectedError } from '../errors'
import { registerFakeCardAdapter } from '../../../__tests__/fakeCardAdapter'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

const ALGORAND_TESTNET = { chainId: 'algorand', networkId: 'testnet' } as const
const ALGORAND_MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const

const signData = { data: 'ZGF0YQ==', authenticatorData: 'YXV0aA==' }

describe('fetchDelegationToken', () => {
    beforeEach(() => vi.clearAllMocks())

    it('GETs /v1/delegation/token authenticated and returns the pair', async () => {
        request.mockResolvedValue({
            data: { token: 'tok-1', nonce: 'bm9uY2U=' },
        })

        const result = await fetchDelegationToken({ scope: ALGORAND_MAINNET })

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
            fetchDelegationToken({ scope: ALGORAND_MAINNET }),
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

        const wallets = await fetchExternalWallets({ scope: ALGORAND_MAINNET })

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

        const wallets = await fetchExternalWallets({ scope: ALGORAND_MAINNET })

        expect(wallets[0].allowance.isZero()).toBe(true)
        expect(wallets[0].balance.isZero()).toBe(true)
    })
})

describe('postDelegationApproval', () => {
    beforeEach(() => vi.clearAllMocks())

    const approval = {
        address: 'FUNDINGADDR',
        currency: 'usdc',
        txId: 'TX123',
        signData,
        signature: 'c2ln',
        token: 'ABC_tok',
    }
    const params = {
        scope: { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const,
        ...approval,
    }

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
                scope: ALGORAND_TESTNET,
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

describe('postCardDelegation', () => {
    beforeEach(() => vi.clearAllMocks())

    const scope = { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const
    const delegation = {
        path: '/v1/delegation/chain/delegator-lsig',
        data: { body: 'chain' },
    }

    it('POSTs the route and body with the user Bearer', async () => {
        request.mockResolvedValue({ data: { success: true }, status: 201 })

        await postCardDelegation(delegation, scope)

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                scope: ALGORAND_TESTNET,
                method: 'POST',
                path: '/v1/delegation/chain/delegator-lsig',
                authenticated: true,
                data: { body: 'chain' },
            }),
        )
        expect(request.mock.calls[0][0]).not.toHaveProperty('route')
    })

    it('rejects a delegation Baanx did not accept', async () => {
        request.mockResolvedValue({ data: { success: false }, status: 200 })

        await expect(postCardDelegation(delegation, scope)).rejects.toThrow(
            'Card delegation was rejected',
        )
    })

    it('accepts a 2xx whose body carries no success flag', async () => {
        // The delegation service answers some calls with a bare status line.
        // Treating an unreadable 2xx as a failure would strand a registration
        // that already succeeded.
        for (const data of ['Created', undefined, null, 42]) {
            request.mockResolvedValue({ data, status: 201 })
            await expect(
                postCardDelegation(delegation, scope),
            ).resolves.toBeUndefined()
        }
    })
})

describe('postAutoDrawDelegation', () => {
    beforeEach(() => vi.clearAllMocks())

    const scope = { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const
    const delegation = {
        path: '/v1/delegation/chain/delegator-lsig',
        data: { body: 'chain' },
    }

    it('registers the delegation on the authenticated direct route', async () => {
        request.mockResolvedValue({ data: { success: true }, status: 201 })

        await postAutoDrawDelegation(delegation, scope)

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                path: '/v1/delegation/chain/delegator-lsig',
                authenticated: true,
            }),
        )
    })

    it('turns a 403 into a non-recoverable rejection carrying the Baanx reason', async () => {
        request.mockRejectedValue({
            response: {
                status: 403,
                text: async () =>
                    JSON.stringify({
                        message:
                            'Card address is not a delegated wallet of the authenticated user',
                    }),
            },
        })

        const error = await postAutoDrawDelegation(delegation, scope).catch(
            (e: unknown) => e,
        )

        expect(error).toBeInstanceOf(AutoDrawDelegationRejectedError)
        expect(error).toMatchObject({
            metadata: {
                recoverable: false,
                params: {
                    reason: 'Card address is not a delegated wallet of the authenticated user',
                },
            },
        })
    })

    it('rethrows any other failure unchanged so the caller can retry', async () => {
        const failure = { response: { status: 500, text: async () => '' } }
        request.mockRejectedValue(failure)

        await expect(postAutoDrawDelegation(delegation, scope)).rejects.toBe(
            failure,
        )
    })
})
