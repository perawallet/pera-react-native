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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import '../../i18n'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useChartCurrencyFallback } from '../useChartCurrencyFallback'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const defaultCurrency = vi.mocked(useCurrency).getMockImplementation()!

const withRate = (overrides: Partial<ReturnType<typeof useCurrency>>) =>
    vi.mocked(useCurrency).mockReturnValue({
        ...defaultCurrency(SCOPE),
        ...overrides,
    })

describe('useChartCurrencyFallback', () => {
    beforeEach(() => {
        vi.mocked(useCurrency).mockImplementation(defaultCurrency)
    })

    it('adds no error and no copy while the rate is usable and the history is fine', () => {
        const { result } = renderHook(() =>
            useChartCurrencyFallback(SCOPE, {
                isError: false,
                refetch: vi.fn(),
            }),
        )

        expect(result.current.isError).toBe(false)
        expect(result.current.errorBody).toBeUndefined()
    })

    it('reports an error that names the currency when the rate is unavailable, though the history itself is fine', () => {
        withRate({ preferredCurrency: 'ARS', isRateUnavailable: true })

        const { result } = renderHook(() =>
            useChartCurrencyFallback(SCOPE, {
                isError: false,
                refetch: vi.fn(),
            }),
        )

        expect(result.current.isError).toBe(true)
        expect(result.current.errorBody).toBe(
            "This chart isn't available in ARS right now",
        )
    })

    it("keeps the chart's generic error copy when only the history failed", () => {
        const { result } = renderHook(() =>
            useChartCurrencyFallback(SCOPE, {
                isError: true,
                refetch: vi.fn(),
            }),
        )

        expect(result.current.isError).toBe(true)
        expect(result.current.errorBody).toBeUndefined()
    })

    it.each([
        ['the rate', true, false, 1, 0],
        ['the history', false, true, 0, 1],
        ['both', true, true, 1, 1],
        ['neither', false, false, 0, 0],
    ])(
        'on retry asks again for %s only when it failed',
        (_, isRateUnavailable, isError, rateCalls, historyCalls) => {
            const refetchRate = vi.fn()
            const refetch = vi.fn()
            withRate({ isRateUnavailable, refetchRate })
            const { result } = renderHook(() =>
                useChartCurrencyFallback(SCOPE, { isError, refetch }),
            )

            result.current.onRetry()

            expect(refetchRate).toHaveBeenCalledTimes(rateCalls)
            expect(refetch).toHaveBeenCalledTimes(historyCalls)
        },
    )
})
