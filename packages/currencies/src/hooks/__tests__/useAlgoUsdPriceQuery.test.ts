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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
    QueryClient,
    QueryClientProvider,
    onlineManager,
} from '@tanstack/react-query'
import { useAlgoUsdPriceQuery } from '../useAlgoUsdPriceQuery'
import React from 'react'
import { Decimal } from 'decimal.js'

const mockAll = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-database', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-database')
    >('@perawallet/wallet-core-database')

    const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        all: mockAll,
    }

    return {
        ...actual,
        getDatabase: () => ({
            select: vi.fn(() => chain),
        }),
    }
})

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

describe('useAlgoUsdPriceQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
        vi.clearAllMocks()
    })

    afterEach(() => {
        // onlineManager is a global singleton — restore connectivity so an
        // offline test can't leak into the next one.
        onlineManager.setOnline(true)
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it('fetches ALGO USD price as Decimal from DB', async () => {
        mockAll.mockResolvedValue([{ usdPrice: new Decimal('0.15') }])

        const { result } = renderHook(() => useAlgoUsdPriceQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data).toEqual(new Decimal('0.15'))
    })

    it('handles loading state', () => {
        mockAll.mockImplementation(() => new Promise(() => {}))

        const { result } = renderHook(() => useAlgoUsdPriceQuery(), {
            wrapper,
        })

        expect(result.current.isPending).toBe(true)
    })

    it('does not fetch when disabled', () => {
        const { result } = renderHook(() => useAlgoUsdPriceQuery(false), {
            wrapper,
        })

        expect(result.current.fetchStatus).toBe('idle')
        expect(mockAll).not.toHaveBeenCalled()
    })

    it('serves the ALGO price from SQLite while offline', async () => {
        // SQLite is the source of truth; a DB-backed price read must run and
        // resolve even when onlineManager reports offline, instead of pausing
        // its queryFn (TanStack's default networkMode: 'online' behaviour).
        onlineManager.setOnline(false)
        mockAll.mockResolvedValue([{ usdPrice: new Decimal('0.15') }])

        const { result } = renderHook(() => useAlgoUsdPriceQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data).toEqual(new Decimal('0.15'))
    })

    it('returns zero when no price found in DB', async () => {
        mockAll.mockResolvedValue([])

        const { result } = renderHook(() => useAlgoUsdPriceQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data).toEqual(new Decimal(0))
    })
})
