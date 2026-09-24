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

import { describe, test, expect, vi, beforeEach, Mock } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { Networks } from '@perawallet/wallet-core-config'

import { useArc59SendSummaryQuery } from '../useArc59SendSummaryQuery'
import { fetchArc59SendSummary } from '../../api'

const mockNetwork = { network: 'testnet' }
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn(() => mockNetwork),
}))

vi.mock('../../api', () => ({
    fetchArc59SendSummary: vi.fn(),
}))

const RECEIVER = 'TESTRECEIVER123'
const ASSET_ID = '12345'

const mockSummary = {
    is_arc59_opted_in: true,
    minimum_balance_requirement: 100000,
    inner_tx_count: 2,
    total_protocol_and_mbr_fee: 4000,
    inbox_address: null,
    algo_fund_amount: 0,
    warning_message: null,
}

describe('useArc59SendSummaryQuery', () => {
    let queryClient: QueryClient
    let wrapper: React.FC<{ children: React.ReactNode }>

    beforeEach(() => {
        vi.clearAllMocks()
        mockNetwork.network = 'testnet'
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        })
        wrapper = ({ children }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )
    })

    test('fetches summary and returns data on success', async () => {
        ;(fetchArc59SendSummary as Mock).mockResolvedValue(mockSummary)

        const { result } = renderHook(
            () => useArc59SendSummaryQuery(RECEIVER, ASSET_ID),
            { wrapper },
        )

        expect(result.current.isLoading).toBe(true)
        expect(result.current.data).toBeUndefined()

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.data).toEqual(mockSummary)
        expect(result.current.isError).toBe(false)
        expect(result.current.error).toBeNull()
    })

    test('passes network, receiverAddress, and assetId to fetch function', async () => {
        ;(fetchArc59SendSummary as Mock).mockResolvedValue(mockSummary)

        const { result } = renderHook(
            () => useArc59SendSummaryQuery(RECEIVER, ASSET_ID),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(fetchArc59SendSummary).toHaveBeenCalledWith(
            'testnet',
            RECEIVER,
            ASSET_ID,
        )
    })

    test('returns error state when fetch fails', async () => {
        const mockError = new Error('Network error')
        ;(fetchArc59SendSummary as Mock).mockRejectedValue(mockError)

        const { result } = renderHook(
            () => useArc59SendSummaryQuery(RECEIVER, ASSET_ID),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.data).toBeUndefined()
        expect(result.current.error).toBe(mockError)
    })

    test('does not fetch when receiverAddress is empty', async () => {
        ;(fetchArc59SendSummary as Mock).mockResolvedValue(mockSummary)

        const { result } = renderHook(
            () => useArc59SendSummaryQuery('', ASSET_ID),
            { wrapper },
        )

        // Query is disabled, should stay in pending state without fetching
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(fetchArc59SendSummary).not.toHaveBeenCalled()
        expect(result.current.data).toBeUndefined()
    })

    test('does not fetch when assetId is empty', async () => {
        ;(fetchArc59SendSummary as Mock).mockResolvedValue(mockSummary)

        const { result } = renderHook(
            () => useArc59SendSummaryQuery(RECEIVER, ''),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(fetchArc59SendSummary).not.toHaveBeenCalled()
        expect(result.current.data).toBeUndefined()
    })

    test('uses different cache entries for different params', async () => {
        ;(fetchArc59SendSummary as Mock)
            .mockResolvedValueOnce(mockSummary)
            .mockResolvedValueOnce({
                ...mockSummary,
                is_arc59_opted_in: false,
            })

        const { result: result1 } = renderHook(
            () => useArc59SendSummaryQuery(RECEIVER, '111'),
            { wrapper },
        )

        await waitFor(() => expect(result1.current.isLoading).toBe(false))
        expect(result1.current.data?.is_arc59_opted_in).toBe(true)

        const { result: result2 } = renderHook(
            () => useArc59SendSummaryQuery(RECEIVER, '222'),
            { wrapper },
        )

        await waitFor(() => expect(result2.current.isLoading).toBe(false))
        expect(result2.current.data?.is_arc59_opted_in).toBe(false)

        expect(fetchArc59SendSummary).toHaveBeenCalledTimes(2)
    })

    test.each([Networks.betanet, Networks.custom])(
        'does not fetch and reports isUnavailableOnNetwork on %s',
        network => {
            mockNetwork.network = network

            const { result } = renderHook(
                () => useArc59SendSummaryQuery(RECEIVER, ASSET_ID),
                { wrapper },
            )

            expect(result.current.isUnavailableOnNetwork).toBe(true)
            expect(result.current.isLoading).toBe(false)
            expect(fetchArc59SendSummary).not.toHaveBeenCalled()
        },
    )

    test.each([Networks.mainnet, Networks.testnet])(
        'reports isUnavailableOnNetwork false on %s',
        async network => {
            mockNetwork.network = network
            ;(fetchArc59SendSummary as Mock).mockResolvedValue(mockSummary)

            const { result } = renderHook(
                () => useArc59SendSummaryQuery(RECEIVER, ASSET_ID),
                { wrapper },
            )

            await waitFor(() => expect(result.current.isLoading).toBe(false))

            expect(result.current.isUnavailableOnNetwork).toBe(false)
            expect(fetchArc59SendSummary).toHaveBeenCalled()
        },
    )
})
