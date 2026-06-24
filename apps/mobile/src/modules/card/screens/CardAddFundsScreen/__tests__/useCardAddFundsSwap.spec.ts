/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { renderHook, waitFor } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'

const mockCreateQuotes = vi.fn()
const mockExecute = vi.fn()
const mockStatus = vi.hoisted(() => ({ value: 'idle' as string }))

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const { Decimal: D } =
        await vi.importActual<typeof import('decimal.js')>('decimal.js')
    return {
        useNetwork: () => ({ network: 'mainnet' }),
        displayUnitsToBaseUnits: (a: unknown, d: number) =>
            new D(String(a)).mul(D.pow(10, d)),
        baseUnitsToDisplayUnits: (a: unknown, d: number) =>
            new D(String(a)).div(D.pow(10, d)),
    }
})

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => 'device-1',
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useCreateQuotesMutation: () => ({
        mutateAsync: mockCreateQuotes,
        isPending: false,
    }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    useDebouncedValue: (value: unknown) => value,
    isDecimalEqual: (
        a: { equals?: (b: unknown) => boolean } | null,
        b: unknown,
    ) =>
        a == null && b == null
            ? true
            : a != null && b != null
              ? !!a.equals?.(b)
              : false,
    uint64IdToNumber: (id: string) => Number(id),
}))

vi.mock('@modules/swap/hooks', () => ({
    useSwapExecution: () => ({
        execute: mockExecute,
        status: mockStatus.value,
    }),
}))

vi.mock('@modules/swap/hooks/swapQuoteHelpers', () => ({
    pickBestByAmountOut: (quotes: { quoteIdStr: string }[]) =>
        quotes[0] ?? null,
    formatSwapRate: (quote: { quoteIdStr: string }) =>
        `rate:${quote.quoteIdStr}`,
}))

import { useCardAddFundsSwap } from '../useCardAddFundsSwap'

const ACCOUNT = { address: 'ADDR' } as never
const ALGO_ID = '0'
const USDC_ID = '31566704'

const QUOTE = {
    quoteIdStr: 'q1',
    amountOut: new Decimal('5000000'), // 5 USDC in base units (6 decimals)
    assetIn: { unitName: 'ALGO' },
    assetOut: { unitName: 'USDC' },
    price: new Decimal('0.3'),
}

const baseParams = {
    account: ACCOUNT,
    sourceAssetId: ALGO_ID,
    sourceDecimals: 6,
    usdcAssetId: USDC_ID,
    usdcDecimals: 6,
    amount: new Decimal(5),
    enabled: true,
}

describe('useCardAddFundsSwap', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockStatus.value = 'idle'
        mockCreateQuotes.mockResolvedValue([QUOTE])
        mockExecute.mockResolvedValue({ kind: 'success' })
    })

    it('fetches a fixed-input quote (asset → USDC) and exposes rate + USDC output', async () => {
        const { result } = renderHook(() => useCardAddFundsSwap(baseParams))

        await waitFor(() => expect(result.current.quote).toBeTruthy())

        expect(mockCreateQuotes).toHaveBeenCalledWith({
            swapper_address: 'ADDR',
            swap_type: 'fixed-input',
            asset_in_id: 0,
            asset_out_id: 31_566_704,
            amount: '5000000',
            device: 'device-1',
        })
        expect(result.current.rate).toBe('rate:q1')
        expect(result.current.usdcOut?.toString()).toBe('5')
    })

    it('does not fetch a quote when disabled (USDC mode)', async () => {
        const { result } = renderHook(() =>
            useCardAddFundsSwap({ ...baseParams, enabled: false }),
        )

        await waitFor(() => expect(result.current.isQuoteFetching).toBe(false))
        expect(mockCreateQuotes).not.toHaveBeenCalled()
        expect(result.current.quote).toBeNull()
    })

    it('executeSwap runs the best quote and maps the outcome', async () => {
        const { result } = renderHook(() => useCardAddFundsSwap(baseParams))
        await waitFor(() => expect(result.current.quote).toBeTruthy())

        const success = await result.current.executeSwap()
        expect(mockExecute).toHaveBeenCalledWith('q1')
        expect(success).toEqual({ kind: 'success' })

        mockExecute.mockResolvedValue({
            kind: 'error',
            phase: 'submission',
            message: 'boom',
        })
        const failure = await result.current.executeSwap()
        expect(failure).toEqual({ kind: 'error', message: 'boom' })
    })
})
