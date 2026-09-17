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

import { approveEscrowCard } from '../endpoints'

const signData = { data: 'ZGF0YQ==', authenticatorData: 'YXV0aA==' }

const approveParams = {
    network: 'testnet' as const,
    cardAddress: 'ESCROW_CARD',
    currency: 'usdc',
    signData,
    signature: 'c2ln',
    txId: 'TX123',
}

// AB echoes the stored record; only `address` is read back.
const approvalEcho = {
    blockchain: 'algorand',
    address: 'ESCROW_CARD',
    currency: 'usdc',
    amount: '0',
    transaction: { hash: 'TX123', blockNumber: null },
    status: 'UNKNOWN',
    userId: 'ANONYMOUS',
}

describe('approveEscrowCard', () => {
    beforeEach(() => vi.clearAllMocks())

    it("POSTs exactly AB's approval schema, keyed by the card address, with the tx hash nested", async () => {
        request.mockResolvedValue({ data: approvalEcho })

        const result = await approveEscrowCard(approveParams)

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                route: 'escrow',
                method: 'POST',
                path: '/api/approvals',
                data: {
                    blockchain: 'algorand',
                    address: 'ESCROW_CARD',
                    currency: 'usdc',
                    amount: '0',
                    transaction: { hash: 'TX123' },
                    signData,
                    signature: 'c2ln',
                },
            }),
        )
        // AB rejects unknown fields, so the legacy top-level txId must be gone.
        const sent = request.mock.calls[0][0].data
        expect(sent).not.toHaveProperty('txId')
        expect(result).toEqual({ cardAddress: 'ESCROW_CARD' })
    })

    it('resolves null when AB reports the card was already created', async () => {
        request.mockRejectedValue({
            response: {
                status: 400,
                text: async () =>
                    JSON.stringify({ message: 'Card already created' }),
            },
        })

        await expect(approveEscrowCard(approveParams)).resolves.toBeNull()
    })

    it('rethrows a non-already-created approval failure', async () => {
        request.mockRejectedValue({
            response: {
                status: 422,
                text: async () =>
                    JSON.stringify({ message: 'Invalid signature' }),
            },
        })

        await expect(approveEscrowCard(approveParams)).rejects.toBeTruthy()
    })

    it('rejects when the echo carries no card address', async () => {
        request.mockResolvedValue({ data: {} })

        await expect(approveEscrowCard(approveParams)).rejects.toThrow()
    })
})
