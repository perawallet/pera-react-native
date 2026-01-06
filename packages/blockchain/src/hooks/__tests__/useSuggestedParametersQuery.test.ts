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

import { useSuggestedParametersQuery } from '../useSuggestedParametersQuery'
import { useAlgorandClient } from '../useAlgorandClient'

// Mock the useAlgorandClient hook
vi.mock('../useAlgorandClient')

describe('useSuggestedParametersQuery', () => {
    let queryClient: QueryClient
    let wrapper: React.FC<{ children: React.ReactNode }>

    const mockSuggestedParams = {
        fee: 1000,
        firstRound: 100,
        lastRound: 1100,
        genesisID: 'testnet-v1.0',
        genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
        minFee: 1000,
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
            getSuggestedParams: vi.fn().mockResolvedValue(mockSuggestedParams),
        })
    })

    test('fetches suggested parameters', async () => {
        const { result } = renderHook(() => useSuggestedParametersQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data).toEqual(mockSuggestedParams)
    })

    test('provides loading state initially', () => {
        const { result } = renderHook(() => useSuggestedParametersQuery(), {
            wrapper,
        })

        expect(result.current.isPending).toBe(true)
    })

    test('handles errors', async () => {
        const mockError = new Error('Network error')
        ;(useAlgorandClient as Mock).mockReturnValue({
            getSuggestedParams: vi.fn().mockRejectedValue(mockError),
        })

        const { result } = renderHook(() => useSuggestedParametersQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error).toBe(mockError)
    })
})
