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

import React from 'react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    accountInformation: vi.fn(),
    knownUsdcId: '10458941' as string | null,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'testnet' }),
    useAlgorandClient: () => ({
        client: {
            algod: {
                accountInformation: () => ({ do: mocks.accountInformation }),
            },
        },
    }),
}))
vi.mock('@perawallet/wallet-core-assets', () => ({
    getKnownAssetId: () => mocks.knownUsdcId,
}))

import {
    useCardUsdcCreditQuery,
    UsdcCreditTimeoutError,
} from '../useCardUsdcCreditQuery'

const holding = (amount: bigint) => ({
    assets: [{ assetId: 10_458_941n, amount }],
})

const renderCredit = () => {
    const client = new QueryClient()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    return renderHook(() => useCardUsdcCreditQuery(), { wrapper })
}

describe('useCardUsdcCreditQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.knownUsdcId = '10458941'
        vi.useFakeTimers()
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it('reads the USDC holding fresh each time and reports zero when not opted in', async () => {
        mocks.accountInformation.mockResolvedValueOnce(holding(2_500_000n))
        mocks.accountInformation.mockResolvedValueOnce({ assets: [] })
        const { result } = renderCredit()

        await expect(result.current.readUsdcBalance('ADDR')).resolves.toBe(
            2_500_000n,
        )
        await expect(result.current.readUsdcBalance('ADDR')).resolves.toBe(0n)
    })

    it('reads zero without asking algod on a network with no known USDC', async () => {
        mocks.knownUsdcId = null
        const { result } = renderCredit()

        await expect(result.current.readUsdcBalance('ADDR')).resolves.toBe(0n)
        expect(mocks.accountInformation).not.toHaveBeenCalled()
    })

    it('resolves with the credited delta once the minimum has landed', async () => {
        mocks.accountInformation
            .mockResolvedValueOnce(holding(1_000_000n))
            .mockResolvedValueOnce(holding(1_000_000n))
            .mockResolvedValueOnce(holding(61_000_000n))
        const { result } = renderCredit()

        const pending = result.current.waitForUsdcCredit({
            address: 'ADDR',
            before: 1_000_000n,
            minimum: 59_000_000n,
        })
        await vi.advanceTimersByTimeAsync(3100)

        await expect(pending).resolves.toBe(60_000_000n)
        expect(mocks.accountInformation).toHaveBeenCalledTimes(3)
    })

    it('keeps polling while the credit is below the minimum', async () => {
        mocks.accountInformation
            .mockResolvedValueOnce(holding(1_500_000n))
            .mockResolvedValueOnce(holding(3_000_000n))
        const { result } = renderCredit()

        const pending = result.current.waitForUsdcCredit({
            address: 'ADDR',
            before: 1_000_000n,
            minimum: 2_000_000n,
        })
        await vi.advanceTimersByTimeAsync(1600)

        await expect(pending).resolves.toBe(2_000_000n)
    })

    it('stops polling once the credit lands', async () => {
        mocks.accountInformation.mockResolvedValue(holding(5_000_000n))
        const { result } = renderCredit()

        await expect(
            (async () => {
                const pending = result.current.waitForUsdcCredit({
                    address: 'ADDR',
                    before: 1_000_000n,
                    minimum: 1n,
                })
                await vi.advanceTimersByTimeAsync(10)
                return pending
            })(),
        ).resolves.toBe(4_000_000n)
        await vi.advanceTimersByTimeAsync(10_000)

        expect(mocks.accountInformation).toHaveBeenCalledTimes(1)
    })

    it('gives up once the deadline passes', async () => {
        mocks.accountInformation.mockResolvedValue(holding(1_000_000n))
        const { result } = renderCredit()

        const pending = result.current.waitForUsdcCredit({
            address: 'ADDR',
            before: 1_000_000n,
            minimum: 1n,
        })
        // Attach the handler first so the rejection is never unhandled.
        const outcome = pending.then(
            () => 'resolved',
            (error: unknown) => error,
        )
        await vi.advanceTimersByTimeAsync(46_000)

        await expect(outcome).resolves.toBeInstanceOf(UsdcCreditTimeoutError)
    })

    it('surfaces a failed read at once instead of polling past it', async () => {
        mocks.accountInformation.mockRejectedValue(new Error('algod down'))
        const { result } = renderCredit()

        const outcome = result.current
            .waitForUsdcCredit({
                address: 'ADDR',
                before: 0n,
                minimum: 1n,
            })
            .then(
                () => 'resolved',
                (error: unknown) => error,
            )
        await vi.advanceTimersByTimeAsync(5000)

        await expect(outcome).resolves.toMatchObject({ message: 'algod down' })
        expect(mocks.accountInformation).toHaveBeenCalledTimes(1)
    })
})
