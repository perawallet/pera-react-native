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
    fetchRewardWallet,
    fetchRewardWithdrawEstimation,
    withdrawReward,
} from '../endpoints'

describe('fetchRewardWallet', () => {
    beforeEach(() => vi.clearAllMocks())

    it('GETs /v1/wallet/reward authenticated and transforms the wallet', async () => {
        request.mockResolvedValue({
            data: {
                id: 'rw_1',
                balance: '12.34',
                currency: 'usdc',
                isWithdrawable: true,
            },
        })

        const wallet = await fetchRewardWallet({ network: 'mainnet' })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                path: '/v1/wallet/reward',
                authenticated: true,
            }),
        )
        expect(wallet.balance.toFixed(2)).toBe('12.34')
        expect(wallet.isWithdrawable).toBe(true)
    })

    it('defaults isWithdrawable to false when absent', async () => {
        request.mockResolvedValue({
            data: { id: 'rw_1', balance: '0', currency: 'usdc' },
        })

        const wallet = await fetchRewardWallet({ network: 'mainnet' })
        expect(wallet?.isWithdrawable).toBe(false)
    })

    // Baanx creates the reward wallet on the first credited reward, so every
    // card answers 404 until then. That is an empty balance, not a failure.
    it('resolves null when no reward wallet exists yet', async () => {
        request.mockRejectedValue(
            new HTTPError(
                new Response('{"message":"Wallet not found"}', { status: 404 }),
                new Request('https://dev.api.baanx.com/v1/wallet/reward'),
                {} as never,
            ),
        )

        await expect(
            fetchRewardWallet({ network: 'mainnet' }),
        ).resolves.toBeNull()
    })

    it('still rejects on any other failure', async () => {
        request.mockRejectedValue(
            new HTTPError(
                new Response('nope', { status: 500 }),
                new Request('https://dev.api.baanx.com/v1/wallet/reward'),
                {} as never,
            ),
        )

        await expect(
            fetchRewardWallet({ network: 'mainnet' }),
        ).rejects.toThrow()
    })
})

describe('fetchRewardWithdrawEstimation', () => {
    beforeEach(() => vi.clearAllMocks())

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

        const estimation = await fetchRewardWithdrawEstimation({
            network: 'mainnet',
        })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                path: '/v1/wallet/reward/withdraw-estimation',
                authenticated: true,
            }),
        )
        expect(estimation.fee.toString()).toBe('0.000006219123007416')
        expect(estimation.gas).toBe('6219123007416')
    })
})

describe('withdrawReward', () => {
    beforeEach(() => vi.clearAllMocks())

    it('POSTs the amount authenticated and returns the receipt', async () => {
        request.mockResolvedValue({
            data: { txHash: '0xabc', network: 'linea', confirmed: true },
        })

        const result = await withdrawReward({
            network: 'mainnet',
            amount: '10.5',
        })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                path: '/v1/wallet/reward/withdraw',
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
            withdrawReward({ network: 'mainnet', amount: '1' }),
        ).rejects.toThrow()
    })
})
