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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'

const mockExecute = vi.fn()
const mockStatus = vi.hoisted(() => ({ value: 'idle' as string }))
const mockQuotes = vi.hoisted(() => ({
    allQuotes: [] as unknown[],
    isQuoteFetching: false,
}))

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const { Decimal: D } =
        await vi.importActual<typeof import('decimal.js')>('decimal.js')
    return {
        baseUnitsToDisplayUnits: (a: unknown, d: number) =>
            new D(String(a)).div(D.pow(10, d)),
    }
})

vi.mock('@modules/swap/hooks', () => ({
    useSwapExecution: () => ({
        execute: mockExecute,
        status: mockStatus.value,
    }),
    useSwapQuotes: () => ({
        allQuotes: mockQuotes.allQuotes,
        quotedAmount: null,
        isQuoteFetching: mockQuotes.isQuoteFetching,
        isQuoteError: false,
        reset: vi.fn(),
    }),
}))

vi.mock('@modules/swap/hooks/swapQuoteHelpers', () => ({
    pickBestByAmountOut: (quotes: { quoteIdStr: string }[]) =>
        quotes[0] ?? null,
    formatSwapRate: (quote: { quoteIdStr: string }) =>
        `rate:${quote.quoteIdStr}`,
}))

import { useCardAddFundsSwap } from '../useCardAddFundsSwap'

const QUOTE = {
    quoteIdStr: 'q1',
    amountOut: new Decimal('5000000'), // 5 USDC in base units (6 decimals)
    assetIn: { unitName: 'ALGO' },
    assetOut: { unitName: 'USDC' },
    price: new Decimal('0.3'),
}

const baseParams = {
    account: { address: 'ADDR' } as never,
    sourceAssetId: '0',
    sourceDecimals: 6,
    usdcAssetId: '31566704',
    usdcDecimals: 6,
    amount: new Decimal(5),
    enabled: true,
}

describe('useCardAddFundsSwap', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockStatus.value = 'idle'
        mockQuotes.allQuotes = []
        mockQuotes.isQuoteFetching = false
        mockExecute.mockResolvedValue({ kind: 'success' })
    })

    it('exposes the best quote with its rate and USDC output', () => {
        mockQuotes.allQuotes = [QUOTE]
        const { result } = renderHook(() => useCardAddFundsSwap(baseParams))

        expect(result.current.quote).toBe(QUOTE)
        expect(result.current.rate).toBe('rate:q1')
        expect(result.current.usdcOut?.toString()).toBe('5')
    })

    it('forwards the fetching state and has no quote when none returned', () => {
        mockQuotes.isQuoteFetching = true
        const { result } = renderHook(() => useCardAddFundsSwap(baseParams))

        expect(result.current.isQuoteFetching).toBe(true)
        expect(result.current.quote).toBeNull()
    })

    it('executeSwap runs the best quote and maps the outcome', async () => {
        mockQuotes.allQuotes = [QUOTE]
        const { result } = renderHook(() => useCardAddFundsSwap(baseParams))

        const success = await result.current.executeSwap()
        expect(mockExecute).toHaveBeenCalledWith(
            expect.objectContaining({ quoteIdStr: 'q1' }),
        )
        expect(success).toEqual({ kind: 'success' })

        mockExecute.mockResolvedValue({
            kind: 'error',
            phase: 'submission',
            message: 'boom',
        })
        const failure = await result.current.executeSwap()
        expect(failure).toEqual({ kind: 'error', message: 'boom' })
    })

    it('surfaces a refused rebuild instead of silently cancelling', async () => {
        mockQuotes.allQuotes = [QUOTE]
        mockExecute.mockResolvedValue({ kind: 'verifying-previous' })

        const { result } = renderHook(() => useCardAddFundsSwap(baseParams))
        const outcome = await result.current.executeSwap()

        // `cancelled` renders nothing, so the user taps Confirm and watches
        // the screen do nothing at all.
        expect(outcome).toEqual({ kind: 'verifying' })
    })
})
