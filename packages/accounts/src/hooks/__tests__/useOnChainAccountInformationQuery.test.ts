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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import { useOnChainAccountInformationQuery } from '../useOnChainAccountInformationQuery'

const mockFetchOnChainAccountInformation = vi.hoisted(() => vi.fn())

vi.mock('../endpoints', () => ({
    fetchOnChainAccountInformation: mockFetchOnChainAccountInformation,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
    useAlgorandClient: () => ({}),
}))

// A real, round-trippable Algorand address: the mapper promotes the algod
// string `address` to an algosdk `Address`, which rejects invalid input.
const mockAddress = 'EV37KES2XMAYPUQ5YT5T62RUC5LHNKERPH5QCAJFQF3735U7SE6BU5UQWM'

const mockResponse = {
    address: mockAddress,
    amount: 2_000_000n,
    minBalance: 100_000n,
    status: 'Online',
    rewards: 0n,
    assets: [{ assetId: 31566704n, amount: 500_000n, isFrozen: false }],
}

describe('useOnChainAccountInformationQuery', () => {
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

    test('fetches and maps on-chain account information', async () => {
        mockFetchOnChainAccountInformation.mockResolvedValue(mockResponse)

        const { result } = renderHook(
            () => useOnChainAccountInformationQuery(mockAddress),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data?.address.toString()).toBe(mockAddress)
        expect({
            amount: result.current.data?.amount,
            minBalance: result.current.data?.minBalance,
            status: result.current.data?.status,
            rewards: result.current.data?.rewards,
            assets: result.current.data?.assets,
        }).toEqual({
            amount: 2_000_000n,
            minBalance: 100_000n,
            status: 'Online',
            rewards: 0n,
            assets: [{ assetId: 31566704n, amount: 500_000n, isFrozen: false }],
        })
        expect(mockFetchOnChainAccountInformation).toHaveBeenCalledWith(
            {},
            mockAddress,
        )
    })

    test('maps response with no assets to empty array', async () => {
        mockFetchOnChainAccountInformation.mockResolvedValue({
            ...mockResponse,
            assets: undefined,
        })

        const { result } = renderHook(
            () => useOnChainAccountInformationQuery(mockAddress),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data?.assets).toEqual([])
    })

    test('is disabled when address is empty', () => {
        const { result } = renderHook(
            () => useOnChainAccountInformationQuery(''),
            { wrapper },
        )

        expect(result.current.fetchStatus).toBe('idle')
        expect(result.current.isPending).toBe(true)
    })
})
