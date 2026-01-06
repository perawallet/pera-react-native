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

import { describe, test, expect, vi, beforeEach, Mock } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import { useAccountInformationQuery } from '../useAccountInformationQuery'
import { useAlgorandClient } from '../useAlgorandClient'

// Mock the useAlgorandClient hook
vi.mock('../useAlgorandClient')

describe('useAccountInformationQuery', () => {
    let queryClient: QueryClient
    let wrapper: React.FC<{ children: React.ReactNode }>

    const mockAddress =
        'TESTADDRESS123456789012345678901234567890123456789012345678'
    const mockAccountInfo = {
        minBalance: 100000,
        amount: 1000000,
        address: mockAddress,
        status: 'Online',
        rewards: 0,
    }

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
        wrapper = ({ children }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )

        // Mock the AlgorandClient
        ;(useAlgorandClient as Mock).mockReturnValue({
            client: {
                algod: {
                    accountInformation: vi
                        .fn()
                        .mockResolvedValue(mockAccountInfo),
                },
            },
        })
    })

    test('fetches account information for a given address', async () => {
        const { result } = renderHook(
            () => useAccountInformationQuery(mockAddress),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data).toEqual({
            minBalance: mockAccountInfo.minBalance,
            amount: mockAccountInfo.amount,
            address: mockAccountInfo.address,
            status: mockAccountInfo.status,
            rewards: mockAccountInfo.rewards,
        })
    })

    test('provides loading state initially', () => {
        const { result } = renderHook(
            () => useAccountInformationQuery(mockAddress),
            { wrapper },
        )

        expect(result.current.isPending).toBe(true)
    })

    test('handles errors', async () => {
        const mockError = new Error('Account not found')
        ;(useAlgorandClient as Mock).mockReturnValue({
            client: {
                algod: {
                    accountInformation: vi.fn().mockRejectedValue(mockError),
                },
            },
        })

        const { result } = renderHook(
            () => useAccountInformationQuery(mockAddress),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error).toBe(mockError)
    })

    test('uses address in query key for caching', async () => {
        const address1 = 'ADDRESS1'
        const address2 = 'ADDRESS2'

        const mockAccountInfo1 = { ...mockAccountInfo, address: address1 }
        const mockAccountInfo2 = { ...mockAccountInfo, address: address2 }

        const mockAccountInfoFn = vi
            .fn()
            .mockResolvedValueOnce(mockAccountInfo1)
            .mockResolvedValueOnce(mockAccountInfo2)

        ;(useAlgorandClient as Mock).mockReturnValue({
            client: {
                algod: {
                    accountInformation: mockAccountInfoFn,
                },
            },
        })

        const { result: result1 } = renderHook(
            () => useAccountInformationQuery(address1),
            { wrapper },
        )

        await waitFor(() => expect(result1.current.isSuccess).toBe(true))
        expect(result1.current.data?.address).toBe(address1)

        const { result: result2 } = renderHook(
            () => useAccountInformationQuery(address2),
            { wrapper },
        )

        await waitFor(() => expect(result2.current.isSuccess).toBe(true))
        expect(result2.current.data?.address).toBe(address2)

        // Both addresses should have been fetched
        expect(mockAccountInfoFn).toHaveBeenCalledWith(address1)
        expect(mockAccountInfoFn).toHaveBeenCalledWith(address2)
    })
})
