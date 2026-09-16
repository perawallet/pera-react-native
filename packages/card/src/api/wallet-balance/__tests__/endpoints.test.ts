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
    fetchWalletWithdrawEstimation,
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
    [CardWalletKind.Reward, '/v1/wallet/reward'],
    [CardWalletKind.Credit, '/v1/wallet/credit'],
])('wallet balance endpoints for %s', (kind, basePath) => {
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

    describe('fetchWalletWithdrawEstimation', () => {
        it('GETs the estimation authenticated and wraps the fee in Decimal', async () => {
            request.mockResolvedValue({
                data: {
                    gas: '6219123007416',
                    fee: '0.000006219123007416',
                    // Deprecated twins the schema must strip, not choke on.
                    wei: '6219123007416',
                    eth: '0.000006219123007416',
                },
            })

            const estimation = await fetchWalletWithdrawEstimation({
                kind,
                network: 'mainnet',
            })

            expect(request).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'GET',
                    path: `${basePath}/withdraw-estimation`,
                    authenticated: true,
                }),
            )
            expect(estimation.fee.toString()).toBe('0.000006219123007416')
            expect(estimation.gas).toBe('6219123007416')
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
