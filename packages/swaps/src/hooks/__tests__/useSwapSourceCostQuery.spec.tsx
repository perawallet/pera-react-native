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

// @vitest-environment jsdom
import React from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import type { SwapQuote } from '../../models'
import { swapChainAdapters } from '../../chain-adapter'
import { registerFakeSwapAdapter } from '../../__tests__/fakeSwapAdapter'
import { useSwapSourceCostQuery } from '../useSwapSourceCostQuery'

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const
const QUOTE = { quoteId: 'quote-1' } as SwapQuote
const COST = {
    networkFee: new Decimal(21_000),
    shortfall: null,
    needsSpendApproval: false,
    nativeSymbol: 'NAT',
    nativeDecimals: 18,
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })}
    >
        {children}
    </QueryClientProvider>
)

const render = () =>
    renderHook(() => useSwapSourceCostQuery({ quote: QUOTE, scope: SCOPE }), {
        wrapper,
    })

describe('swaps/useSwapSourceCostQuery', () => {
    afterEach(() => {
        swapChainAdapters.reset()
    })

    test('reads the source cost from the chain adapter', async () => {
        const estimateSourceCost = vi.fn(async () => COST)
        registerFakeSwapAdapter({ estimateSourceCost })

        const { result } = render()

        await waitFor(() => expect(result.current.sourceCost).toEqual(COST))
        expect(estimateSourceCost).toHaveBeenCalledWith({
            quote: QUOTE,
            scope: SCOPE,
        })
    })

    test('shows nothing for a chain with nothing to show', async () => {
        registerFakeSwapAdapter({ estimateSourceCost: async () => null })

        const { result } = render()

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.sourceCost).toBeNull()
    })

    test('blocks nothing when the read fails', async () => {
        registerFakeSwapAdapter({
            estimateSourceCost: async () => {
                throw new Error('offline')
            },
        })

        const { result } = render()

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.sourceCost).toBeNull()
    })
})
