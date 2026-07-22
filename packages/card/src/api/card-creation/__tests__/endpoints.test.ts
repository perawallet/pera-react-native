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

import { createCard } from '../endpoints'

const signData = { data: 'ZGF0YQ==', authenticatorData: 'YXV0aA==' }

describe('createCard', () => {
    beforeEach(() => vi.clearAllMocks())

    it('POSTs /v3/baanx/escrow-card on the proxy route with the integrity header', async () => {
        request.mockResolvedValue({
            data: { cardAddress: 'ESCROW_CARD', txId: 'TX123' },
        })

        const result = await createCard({
            network: 'testnet',
            address: 'FUNDING_ADDR',
            currency: 'usdc',
            signData,
            signature: 'c2ln',
            integrityToken: 'INTEGRITY_TOKEN',
        })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                route: 'proxy',
                method: 'POST',
                path: '/v3/baanx/escrow-card',
                data: {
                    address: 'FUNDING_ADDR',
                    currency: 'usdc',
                    signData,
                    signature: 'c2ln',
                },
                headers: { 'x-app-integrity-token': 'INTEGRITY_TOKEN' },
            }),
        )
        expect(result).toEqual({ cardAddress: 'ESCROW_CARD', txId: 'TX123' })
    })

    it('rejects on a malformed response', async () => {
        request.mockResolvedValue({ data: { cardAddress: 'ESCROW_CARD' } })

        await expect(
            createCard({
                network: 'testnet',
                address: 'FUNDING_ADDR',
                currency: 'usdc',
                signData,
                signature: 'c2ln',
                integrityToken: 'INTEGRITY_TOKEN',
            }),
        ).rejects.toThrow()
    })
})
