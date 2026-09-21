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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    accountInformation: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-blockchain')),
    useNetwork: () => ({ network: 'testnet' }),
    useAlgorandClient: () => ({
        client: {
            algod: {
                accountInformation: () => ({ do: mocks.accountInformation }),
            },
        },
    }),
}))
vi.mock('@perawallet/wallet-core-assets', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-assets')),
    getKnownAssetId: () => '10458941',
}))

import { useCardUsdcCredit, UsdcCreditTimeoutError } from '../useCardUsdcCredit'

const holding = (amount: bigint) => ({
    assets: [{ assetId: 10_458_941n, amount }],
})

describe('useCardUsdcCredit', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it('reads the USDC holding and reports zero when not opted in', async () => {
        mocks.accountInformation.mockResolvedValueOnce(holding(2_500_000n))
        mocks.accountInformation.mockResolvedValueOnce({ assets: [] })
        const { result } = renderHook(() => useCardUsdcCredit())

        await expect(result.current.readUsdcBalance('ADDR')).resolves.toBe(
            2_500_000n,
        )
        await expect(result.current.readUsdcBalance('ADDR')).resolves.toBe(0n)
    })

    it('resolves with the credited delta once the minimum has landed', async () => {
        mocks.accountInformation
            .mockResolvedValueOnce(holding(1_000_000n))
            .mockResolvedValueOnce(holding(1_000_000n))
            .mockResolvedValueOnce(holding(61_000_000n))
        const { result } = renderHook(() => useCardUsdcCredit())

        const pending = result.current.waitForUsdcCredit({
            address: 'ADDR',
            before: 1_000_000n,
            minimum: 59_000_000n,
        })
        await vi.advanceTimersByTimeAsync(3100)

        await expect(pending).resolves.toBe(60_000_000n)
    })

    it('gives up once the deadline passes', async () => {
        mocks.accountInformation.mockResolvedValue(holding(1_000_000n))
        const { result } = renderHook(() => useCardUsdcCredit())

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
})
