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
import { HTTPError } from 'ky'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../../transport', () => ({ getCardTransport: () => ({ request }) }))

import {
    fetchWalletBalance,
    fetchWalletHistory,
    withdrawWalletBalance,
} from '../endpoints'
import { CardWalletKind } from '../../../models'

const httpError = (status: number, path: string) =>
    new HTTPError(
        new Response('{"message":"Wallet not found"}', { status }),
        new Request(`https://dev.api.baanx.com${path}`),
        {} as never,
    )

// Both Baanx wallets share one contract and differ only by path segment, so
// every case runs once per kind to prove neither is hardwired to the other.
describe.each([
    [CardWalletKind.Reward, '/v1/wallet/reward', 'REWARD'],
    [CardWalletKind.Credit, '/v1/wallet/credit', 'CREDIT'],
])('wallet balance endpoints for %s', (kind, basePath, walletType) => {
    beforeEach(() => vi.clearAllMocks())

    describe('fetchWalletBalance', () => {
        it('GETs the wallet authenticated and transforms it', async () => {
            request.mockResolvedValue({
                data: {
                    id: 'w_1',
                    balance: '12.34',
                    currency: 'usdc',
                    isWithdrawable: true,
                },
            })

            const wallet = await fetchWalletBalance({
                kind,
                network: 'mainnet',
            })

            expect(request).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'GET',
                    path: basePath,
                    authenticated: true,
                }),
            )
            expect(wallet?.balance.toFixed(2)).toBe('12.34')
            expect(wallet?.isWithdrawable).toBe(true)
        })

        it('defaults isWithdrawable to false when absent', async () => {
            request.mockResolvedValue({
                data: { id: 'w_1', balance: '0', currency: 'usdc' },
            })

            const wallet = await fetchWalletBalance({
                kind,
                network: 'mainnet',
            })
            expect(wallet?.isWithdrawable).toBe(false)
        })

        // Baanx creates the wallet on the first credited reward or refund, so
        // every card answers 404 until then. That is an empty balance, not a
        // failure.
        it('resolves null when the wallet does not exist yet', async () => {
            request.mockRejectedValue(httpError(404, basePath))

            await expect(
                fetchWalletBalance({ kind, network: 'mainnet' }),
            ).resolves.toBeNull()
        })

        it('still rejects on any other failure', async () => {
            request.mockRejectedValue(httpError(500, basePath))

            await expect(
                fetchWalletBalance({ kind, network: 'mainnet' }),
            ).rejects.toThrow()
        })
    })

    describe('fetchWalletHistory', () => {
        const row = (overrides: Record<string, string> = {}) => ({
            name: 'Coffee refund',
            amount: '4.50',
            currency: 'usdc',
            sign: 'credit',
            date: '2026-09-10T09:15:00.000Z',
            ...overrides,
        })

        it('GETs the shared history route scoped to this wallet', async () => {
            request.mockResolvedValue({ data: [row()] })

            const page = await fetchWalletHistory({
                kind,
                walletId: 'w_1',
                page: 2,
                network: 'mainnet',
            })

            expect(request).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'GET',
                    path: '/v1/wallet/history',
                    authenticated: true,
                    params: { walletId: 'w_1', walletType, page: 2 },
                }),
            )
            expect(page.page).toBe(2)
            expect(page.items[0].amount.toFixed(2)).toBe('4.50')
            expect(page.items[0].dateTime).toBe('2026-09-10T09:15:00.000Z')
        })

        // Baanx sends the direction lowercase and the shared enum is
        // uppercase; anything else must not crash the list.
        it('maps the wire sign onto TransactionSign and tolerates unknowns', async () => {
            request.mockResolvedValue({
                data: [
                    row({ sign: 'credit' }),
                    row({ sign: 'debit' }),
                    row({ sign: 'refund?' }),
                ],
            })

            const page = await fetchWalletHistory({
                kind,
                walletId: 'w_1',
                network: 'mainnet',
            })

            expect(page.items.map(item => item.sign)).toEqual([
                'CREDIT',
                'DEBIT',
                null,
            ])
        })

        // Baanx has no total; a full page of 10 is the only signal that more
        // may follow, and a short page is the end.
        it('reports more pages only on a full page', async () => {
            request.mockResolvedValueOnce({
                data: Array.from({ length: 10 }, () => row()),
            })
            request.mockResolvedValueOnce({ data: [row(), row()] })

            const full = await fetchWalletHistory({
                kind,
                walletId: 'w_1',
                network: 'mainnet',
            })
            const short = await fetchWalletHistory({
                kind,
                walletId: 'w_1',
                page: 1,
                network: 'mainnet',
            })

            expect(full.hasMore).toBe(true)
            expect(short.hasMore).toBe(false)
        })
    })

    describe('withdrawWalletBalance', () => {
        it('POSTs the amount authenticated and returns the receipt', async () => {
            request.mockResolvedValue({
                data: { txHash: '0xabc', network: 'linea', confirmed: true },
            })

            const result = await withdrawWalletBalance({
                kind,
                network: 'mainnet',
                amount: '10.5',
            })

            expect(request).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'POST',
                    path: `${basePath}/withdraw`,
                    authenticated: true,
                    data: { amount: '10.5' },
                }),
            )
            expect(result).toEqual({
                txHash: '0xabc',
                network: 'linea',
                isConfirmed: true,
            })
        })

        it('rejects on a malformed response', async () => {
            request.mockResolvedValue({ data: {} })

            await expect(
                withdrawWalletBalance({
                    kind,
                    network: 'mainnet',
                    amount: '1',
                }),
            ).rejects.toThrow()
        })
    })
})
