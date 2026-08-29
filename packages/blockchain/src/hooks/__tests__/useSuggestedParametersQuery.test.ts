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

import { describe, test, expect, vi, beforeEach, afterEach, Mock } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
    QueryClient,
    QueryClientProvider,
    onlineManager,
} from '@tanstack/react-query'
import React from 'react'

import {
    useFetchSuggestedMinFee,
    useFetchSuggestedParameters,
    useSuggestedParametersQuery,
} from '../useSuggestedParametersQuery'
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

    describe('offline behavior', () => {
        afterEach(() => {
            onlineManager.setOnline(true)
        })

        test('rejects with the transport error instead of pausing while offline', async () => {
            const mockError = new Error('Network request failed')
            ;(useAlgorandClient as Mock).mockReturnValue({
                getSuggestedParams: vi.fn().mockRejectedValue(mockError),
            })
            onlineManager.setOnline(false)

            const { result } = renderHook(() => useSuggestedParametersQuery(), {
                wrapper,
            })

            // networkMode 'always' must run the queryFn and surface the
            // rejection — the default 'online' mode would sit paused with
            // isPending forever.
            await waitFor(() => expect(result.current.isError).toBe(true))
            expect(result.current.fetchStatus).not.toBe('paused')
            expect(result.current.error).toBe(mockError)
        })
    })

    describe('freshness', () => {
        test('serves cache within the TTL and refetches once stale', async () => {
            vi.useFakeTimers()
            try {
                const getSuggestedParams = vi
                    .fn()
                    .mockResolvedValue(mockSuggestedParams)
                ;(useAlgorandClient as Mock).mockReturnValue({
                    getSuggestedParams,
                })

                const first = renderHook(() => useSuggestedParametersQuery(), {
                    wrapper,
                })
                await vi.waitFor(() =>
                    expect(first.result.current.isSuccess).toBe(true),
                )
                first.unmount()
                expect(getSuggestedParams).toHaveBeenCalledTimes(1)

                // Remount inside the TTL: cache is fresh, no refetch.
                const second = renderHook(() => useSuggestedParametersQuery(), {
                    wrapper,
                })
                await vi.waitFor(() =>
                    expect(second.result.current.isSuccess).toBe(true),
                )
                expect(getSuggestedParams).toHaveBeenCalledTimes(1)
                second.unmount()

                // Remount past the 10s TTL: stale, must refetch.
                vi.advanceTimersByTime(10_001)
                const third = renderHook(() => useSuggestedParametersQuery(), {
                    wrapper,
                })
                await vi.waitFor(() =>
                    expect(getSuggestedParams).toHaveBeenCalledTimes(2),
                )
                third.unmount()
            } finally {
                vi.useRealTimers()
            }
        })
    })

    describe('useFetchSuggestedParameters', () => {
        test('fetches on demand only — nothing on mount', async () => {
            const getSuggestedParams = vi
                .fn()
                .mockResolvedValue(mockSuggestedParams)
            ;(useAlgorandClient as Mock).mockReturnValue({
                getSuggestedParams,
            })

            const { result } = renderHook(() => useFetchSuggestedParameters(), {
                wrapper,
            })
            expect(getSuggestedParams).not.toHaveBeenCalled()

            await expect(result.current()).resolves.toEqual(mockSuggestedParams)
            expect(getSuggestedParams).toHaveBeenCalledTimes(1)
        })

        test('shares the eager query cache: fresh within the TTL, refetch once stale', async () => {
            vi.useFakeTimers()
            try {
                const getSuggestedParams = vi
                    .fn()
                    .mockResolvedValue(mockSuggestedParams)
                ;(useAlgorandClient as Mock).mockReturnValue({
                    getSuggestedParams,
                })

                // Seed the cache through the EAGER hook — the fetcher must
                // read the very same entry, not a parallel one.
                const eager = renderHook(() => useSuggestedParametersQuery(), {
                    wrapper,
                })
                await vi.waitFor(() =>
                    expect(eager.result.current.isSuccess).toBe(true),
                )
                eager.unmount()
                expect(getSuggestedParams).toHaveBeenCalledTimes(1)

                const { result } = renderHook(
                    () => useFetchSuggestedParameters(),
                    { wrapper },
                )

                // Within the TTL: served from the shared cache, no refetch.
                await expect(result.current()).resolves.toEqual(
                    mockSuggestedParams,
                )
                expect(getSuggestedParams).toHaveBeenCalledTimes(1)

                // Past the TTL: stale — congestion-driven minFee changes
                // must propagate, so the fetcher refetches.
                vi.advanceTimersByTime(10_001)
                await expect(result.current()).resolves.toEqual(
                    mockSuggestedParams,
                )
                expect(getSuggestedParams).toHaveBeenCalledTimes(2)
            } finally {
                vi.useRealTimers()
            }
        })

        test('propagates the transport rejection to the caller', async () => {
            const mockError = new Error('Network request failed')
            ;(useAlgorandClient as Mock).mockReturnValue({
                getSuggestedParams: vi.fn().mockRejectedValue(mockError),
            })

            const { result } = renderHook(() => useFetchSuggestedParameters(), {
                wrapper,
            })

            await expect(result.current()).rejects.toBe(mockError)
        })
    })

    describe('useFetchSuggestedMinFee', () => {
        test('returns the network minFee as bigint through the shared cache', async () => {
            const getSuggestedParams = vi
                .fn()
                .mockResolvedValue(mockSuggestedParams)
            ;(useAlgorandClient as Mock).mockReturnValue({
                getSuggestedParams,
            })

            const { result } = renderHook(() => useFetchSuggestedMinFee(), {
                wrapper,
            })
            expect(getSuggestedParams).not.toHaveBeenCalled()

            await expect(result.current()).resolves.toBe(1000n)
            // Second call inside the TTL: served from the shared entry.
            await expect(result.current()).resolves.toBe(1000n)
            expect(getSuggestedParams).toHaveBeenCalledTimes(1)
        })

        test('returns the fallback instead of throwing when one is provided', async () => {
            ;(useAlgorandClient as Mock).mockReturnValue({
                getSuggestedParams: vi
                    .fn()
                    .mockRejectedValue(new Error('offline')),
            })

            const { result } = renderHook(() => useFetchSuggestedMinFee(), {
                wrapper,
            })

            await expect(result.current({ fallback: 0n })).resolves.toBe(0n)
        })

        test('propagates the failure when no fallback is provided', async () => {
            const mockError = new Error('Network request failed')
            ;(useAlgorandClient as Mock).mockReturnValue({
                getSuggestedParams: vi.fn().mockRejectedValue(mockError),
            })

            const { result } = renderHook(() => useFetchSuggestedMinFee(), {
                wrapper,
            })

            await expect(result.current()).rejects.toBe(mockError)
        })
    })
})
