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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import { useAccountOptInRoundsQuery } from '../useAccountOptInRoundsQuery'

const mockFetchAccountAssetOptInRounds = vi.hoisted(() => vi.fn())

vi.mock('../endpoints', () => ({
    fetchAccountAssetOptInRounds: mockFetchAccountAssetOptInRounds,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
    useAlgorandClient: () => ({}),
}))

const mockAddress = 'EV37KES2XMAYPUQ5YT5T62RUC5LHNKERPH5QCAJFQF3735U7SE6BU5UQWM'

describe('useAccountOptInRoundsQuery', () => {
    let queryClient: QueryClient
    let wrapper: React.FC<{ children: React.ReactNode }>

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        wrapper = ({ children }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )
    })

    test('fetches opt-in rounds for the address', async () => {
        mockFetchAccountAssetOptInRounds.mockResolvedValue(
            new Map([
                ['10', 100],
                ['20', 200],
            ]),
        )

        const { result } = renderHook(
            () => useAccountOptInRoundsQuery(mockAddress),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.optInRounds.get('10')).toBe(100),
        )

        expect(result.current.optInRounds.get('20')).toBe(200)
        expect(result.current.isPending).toBe(false)
        expect(mockFetchAccountAssetOptInRounds).toHaveBeenCalledWith(
            {},
            mockAddress,
        )
    })

    test('does not fetch when disabled and keeps a stable empty map', async () => {
        const { result, rerender } = renderHook(
            () => useAccountOptInRoundsQuery(mockAddress, false),
            { wrapper },
        )

        expect(result.current.optInRounds.size).toBe(0)
        expect(result.current.isPending).toBe(false)

        const firstMap = result.current.optInRounds
        rerender()
        expect(result.current.optInRounds).toBe(firstMap)

        await Promise.resolve()
        expect(mockFetchAccountAssetOptInRounds).not.toHaveBeenCalled()
    })

    test('does not fetch when the address is missing', async () => {
        const { result } = renderHook(
            () => useAccountOptInRoundsQuery(undefined),
            { wrapper },
        )

        expect(result.current.optInRounds.size).toBe(0)
        expect(result.current.isPending).toBe(false)

        await Promise.resolve()
        expect(mockFetchAccountAssetOptInRounds).not.toHaveBeenCalled()
    })

    test('serves the fresh cache on remount instead of refetching', async () => {
        mockFetchAccountAssetOptInRounds.mockResolvedValue(
            new Map([['10', 100]]),
        )

        const first = renderHook(
            () => useAccountOptInRoundsQuery(mockAddress),
            {
                wrapper,
            },
        )
        await waitFor(() =>
            expect(first.result.current.optInRounds.size).toBe(1),
        )
        first.unmount()

        const second = renderHook(
            () => useAccountOptInRoundsQuery(mockAddress),
            { wrapper },
        )
        await waitFor(() =>
            expect(second.result.current.optInRounds.size).toBe(1),
        )

        expect(mockFetchAccountAssetOptInRounds).toHaveBeenCalledTimes(1)
    })
})
