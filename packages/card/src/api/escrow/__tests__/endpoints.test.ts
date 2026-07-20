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

import { createEscrowCard, postDelegatorLsig } from '../endpoints'

const signData = { data: 'ZGF0YQ==', authenticatorData: 'YXV0aA==' }

describe('createEscrowCard', () => {
    beforeEach(() => vi.clearAllMocks())

    it('POSTs /api/approvals on the escrow route and returns the card address', async () => {
        request.mockResolvedValue({ data: { cardAddress: 'ESCROW_CARD' } })

        const result = await createEscrowCard({
            network: 'testnet',
            address: 'FUNDING_ADDR',
            currency: 'usdc',
            signData,
            signature: 'c2ln',
        })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                route: 'escrow',
                method: 'POST',
                path: '/api/approvals',
                data: {
                    address: 'FUNDING_ADDR',
                    currency: 'usdc',
                    amount: '0',
                    signData,
                    signature: 'c2ln',
                    blockchain: 'algorand',
                },
            }),
        )
        // No client-side `transaction` — the server owns the on-chain create.
        expect(request.mock.calls[0][0].data).not.toHaveProperty('transaction')
        expect(result).toEqual({ cardAddress: 'ESCROW_CARD' })
    })

    it('rejects on a malformed response', async () => {
        request.mockResolvedValue({ data: {} })

        await expect(
            createEscrowCard({
                network: 'testnet',
                address: 'FUNDING_ADDR',
                currency: 'usdc',
                signData,
                signature: 'c2ln',
            }),
        ).rejects.toThrow()
    })
})

describe('postDelegatorLsig', () => {
    beforeEach(() => vi.clearAllMocks())

    it('POSTs /api/internal/delegator-lsig on the escrow route', async () => {
        request.mockResolvedValue({
            data: { delegatorAddress: 'FUNDING_ADDR' },
        })

        const result = await postDelegatorLsig({
            network: 'testnet',
            token: 'usdc',
            delegatorAddress: 'FUNDING_ADDR',
            lsigBytes: 'bHNpZw==',
            cardAddress: 'ESCROW_CARD',
        })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                route: 'escrow',
                method: 'POST',
                path: '/api/internal/delegator-lsig',
                data: {
                    token: 'usdc',
                    delegatorAddress: 'FUNDING_ADDR',
                    lsigBytes: 'bHNpZw==',
                    cardAddress: 'ESCROW_CARD',
                    blockchain: 'algorand',
                },
            }),
        )
        expect(result).toEqual({ delegatorAddress: 'FUNDING_ADDR' })
    })

    it('rejects on a malformed response', async () => {
        request.mockResolvedValue({ data: {} })

        await expect(
            postDelegatorLsig({
                network: 'testnet',
                token: 'usdc',
                delegatorAddress: 'FUNDING_ADDR',
                lsigBytes: 'bHNpZw==',
                cardAddress: 'ESCROW_CARD',
            }),
        ).rejects.toThrow()
    })
})
