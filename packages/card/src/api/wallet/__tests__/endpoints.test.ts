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

import { fetchInternalWallets, withdrawFromCard } from '../endpoints'

describe('fetchInternalWallets', () => {
    beforeEach(() => vi.clearAllMocks())

    it('GETs /v1/wallet/internal and transforms the wallet list', async () => {
        request.mockResolvedValue({
            data: [
                {
                    id: 'wallet_1',
                    balance: '125.50',
                    currency: 'usdc',
                    address: 'BAANX_ADDR',
                    addressMemo: null,
                    addressId: 'addr_1',
                    type: 'INTERNAL',
                },
            ],
        })

        const wallets = await fetchInternalWallets({ network: 'mainnet' })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                path: '/v1/wallet/internal',
            }),
        )
        expect(wallets).toHaveLength(1)
        expect(wallets[0].balance.toFixed(2)).toBe('125.50')
        expect(wallets[0].address).toBe('BAANX_ADDR')
    })
})

describe('withdrawFromCard', () => {
    beforeEach(() => vi.clearAllMocks())

    it('POSTs the Baanx wire body including the misspelled recipientAddrss field', async () => {
        request.mockResolvedValue({ data: { success: true } })

        await withdrawFromCard({
            network: 'mainnet',
            amount: '25.5',
            recipientAddress: 'ALGO_RECIPIENT',
            sourceAddress: 'BAANX_ADDR',
            currency: 'usdc',
        })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                path: '/v1/wallet/internal/withdraw',
                data: {
                    amount: '25.5',
                    recipientAddrss: 'ALGO_RECIPIENT',
                    sourceAddress: 'BAANX_ADDR',
                    currency: 'usdc',
                },
            }),
        )
    })

    it('omits memo keys entirely when not provided', async () => {
        request.mockResolvedValue({ data: { success: true } })

        await withdrawFromCard({
            network: 'mainnet',
            amount: '1',
            recipientAddress: 'ALGO_RECIPIENT',
            sourceAddress: 'BAANX_ADDR',
            currency: 'usdc',
        })

        const body = request.mock.calls[0][0].data as Record<string, unknown>
        expect('recipientMemo' in body).toBe(false)
        expect('sourceMemo' in body).toBe(false)
    })

    it('sends memo fields when provided', async () => {
        request.mockResolvedValue({ data: { success: true } })

        await withdrawFromCard({
            network: 'mainnet',
            amount: '1',
            recipientAddress: 'ALGO_RECIPIENT',
            recipientMemo: 'r-memo',
            sourceAddress: 'BAANX_ADDR',
            sourceMemo: 's-memo',
            currency: 'usdc',
        })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    recipientMemo: 'r-memo',
                    sourceMemo: 's-memo',
                }),
            }),
        )
    })

    it('rejects when the API reports success=false', async () => {
        request.mockResolvedValue({ data: { success: false } })

        await expect(
            withdrawFromCard({
                network: 'mainnet',
                amount: '1',
                recipientAddress: 'ALGO_RECIPIENT',
                sourceAddress: 'BAANX_ADDR',
                currency: 'usdc',
            }),
        ).rejects.toThrow()
    })
})
