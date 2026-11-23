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
import { swapChainAdapters } from '../../chain-adapter'
import { registerFakeSwapAdapter } from '../../__tests__/fakeSwapAdapter'
import { useSwapFeeReservesQuery } from '../useSwapFeeReservesQuery'

const SCOPES = [{ chainId: 'algorand', networkId: 'mainnet' }] as const

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider
        client={
            new QueryClient({
                defaultOptions: { queries: { gcTime: 0, retry: false } },
            })
        }
    >
        {children}
    </QueryClientProvider>
)

const render = () =>
    renderHook(() => useSwapFeeReservesQuery(SCOPES), { wrapper })

describe('swaps/useSwapFeeReservesQuery', () => {
    afterEach(() => {
        swapChainAdapters.reset()
    })

    test("reads each scope's reserve from its chain adapter", async () => {
        const maxAmountFeeReserve = vi.fn(async () => new Decimal(4200))
        registerFakeSwapAdapter({ maxAmountFeeReserve })

        const { result } = render()

        await waitFor(() =>
            expect(result.current.reserves).toEqual([new Decimal(4200)]),
        )
        expect(result.current.isPending).toBe(false)
        expect(maxAmountFeeReserve).toHaveBeenCalledWith(SCOPES[0])
    })

    test('leaves the reserve unknown when the read fails', async () => {
        registerFakeSwapAdapter({
            maxAmountFeeReserve: async () => {
                throw new Error('offline')
            },
        })

        const { result } = render()

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.reserves).toEqual([undefined])
    })
})
