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

import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useAssetPriceHistoryQuery } from '../useAssetPriceHistoryQuery'
import { createWrapper } from './test-utils'
import { QueryClient } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'

// Mock endpoints
const mocks = vi.hoisted(() => ({
    fetchAssetPriceHistory: vi.fn(),
    useNetwork: vi.fn(),
}))

vi.mock('../../api', async importOriginal => {
    const actual = await importOriginal<typeof import('../../api')>()
    return {
        ...actual,
        fetchAssetPriceHistory: mocks.fetchAssetPriceHistory,
    }
})

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mocks.useNetwork,
}))

describe('useAssetPriceHistoryQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useNetwork.mockReturnValue({ network: 'mainnet' })
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
    })

    describe('useAssetPriceHistoryQuery hook', () => {
        it('fetches data successfully and stores raw USD prices', async () => {
            const assetID = '123'
            const period = 'one-day'
            const mockData = [{ datetime: '2023-01-01T00:00:00Z', price: '10' }]
            mocks.fetchAssetPriceHistory.mockResolvedValue(mockData)

            const { result } = renderHook(
                () => useAssetPriceHistoryQuery(assetID, period),
                {
                    wrapper: createWrapper(queryClient),
                },
            )

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toHaveLength(1)
            expect(result.current.data?.[0].usdPrice).toEqual(new Decimal(10))
            expect(result.current.data?.[0].datetime).toBeInstanceOf(Date)
        })

        it('handles loading state', () => {
            mocks.fetchAssetPriceHistory.mockReturnValue(new Promise(() => {}))

            const { result } = renderHook(
                () => useAssetPriceHistoryQuery('123', 'one-day'),
                {
                    wrapper: createWrapper(queryClient),
                },
            )

            expect(result.current.isPending).toBe(true)
        })
    })
})
