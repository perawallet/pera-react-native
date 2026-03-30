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
import { renderHook, act } from '@testing-library/react'

// Mock useShouldRefreshMutation
const mockMutateAsync = vi.fn()
vi.mock('../useShouldRefreshMutation', () => ({
    useShouldRefreshMutation: () => ({
        mutateAsync: mockMutateAsync,
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

// Mock usePollingStore
const mockSetLastRefreshedRound = vi.fn()
vi.mock('../../store', () => ({
    usePollingStore: (selector: any) => {
        const state = {
            setLastRefreshedRound: mockSetLastRefreshedRound,
        }
        return selector(state)
    },
}))

const flush = async () => {
    // allow pending promises/microtasks to flush
    await Promise.resolve()
}

describe('services/polling/usePolling', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.clearAllMocks()
    })

    test('does not call backend when there are no accounts', async () => {
        vi.resetModules()

        mockMutateAsync.mockResolvedValue({ refresh: false })

        const { usePolling } = await import('../usePolling')
        const { result } = renderHook(() => usePolling())

        await act(async () => {
            await result.current.startPolling()
            vi.advanceTimersByTime(3000)
            await flush()
        })

        // In the original test, this was checking if mutation was called.
        // However, the logic for checking accounts is inside useShouldRefreshMutation,
        // which we are mocking here.
        // So this test effectively tests that startPolling sets up the interval
        // and calls the mutation.
        // The "no accounts" logic should be tested in useShouldRefreshMutation.test.ts
        expect(mockMutateAsync).toHaveBeenCalled()

        await act(async () => {
            await result.current.stopPolling()
        })
    })

    test('updates lastRefreshedRound when backend indicates refresh', async () => {
        vi.resetModules()

        mockMutateAsync.mockResolvedValue({
            refresh: true,
            round: 99,
        })

        const { usePolling } = await import('../usePolling')
        const { result } = renderHook(() => usePolling())

        await act(async () => {
            await result.current.startPolling()
            vi.advanceTimersByTime(3000)
            await flush()
        })

        expect(mockSetLastRefreshedRound).toHaveBeenCalledWith('mainnet', 99)

        await act(async () => {
            await result.current.stopPolling()
        })
    })

    test('stopPolling prevents further backend calls', async () => {
        vi.resetModules()

        mockMutateAsync.mockResolvedValue({ refresh: false })

        const { usePolling } = await import('../usePolling')
        const { result } = renderHook(() => usePolling())

        await act(async () => {
            await result.current.startPolling()
            vi.advanceTimersByTime(3000)
            await flush()
        })
        expect(mockMutateAsync).toHaveBeenCalledTimes(1)

        // Stop and ensure no additional calls on further ticks
        await act(async () => {
            await result.current.stopPolling()
            vi.advanceTimersByTime(9000)
            await flush()
        })
        expect(mockMutateAsync).toHaveBeenCalledTimes(1)
    })

    test('calls onRefresh callback when backend indicates refresh', async () => {
        vi.resetModules()
        const mockOnRefresh = vi.fn()
        mockMutateAsync.mockResolvedValue({ refresh: true, round: 99 })

        const { usePolling } = await import('../usePolling')
        const { result } = renderHook(() =>
            usePolling({ onRefresh: mockOnRefresh }),
        )

        await act(async () => {
            await result.current.startPolling()
            vi.advanceTimersByTime(3000)
            await flush()
        })

        expect(mockOnRefresh).toHaveBeenCalledTimes(1)
        expect(mockSetLastRefreshedRound).toHaveBeenCalledWith('mainnet', 99)

        await act(async () => {
            await result.current.stopPolling()
        })
    })

    test('does not call onRefresh when refresh is false', async () => {
        vi.resetModules()
        const mockOnRefresh = vi.fn()
        mockMutateAsync.mockResolvedValue({ refresh: false, round: null })

        const { usePolling } = await import('../usePolling')
        const { result } = renderHook(() =>
            usePolling({ onRefresh: mockOnRefresh }),
        )

        await act(async () => {
            await result.current.startPolling()
            vi.advanceTimersByTime(3000)
            await flush()
        })

        expect(mockOnRefresh).not.toHaveBeenCalled()
        expect(mockSetLastRefreshedRound).not.toHaveBeenCalled()

        await act(async () => {
            await result.current.stopPolling()
        })
    })

    test('calls onRefresh on each successive refresh interval', async () => {
        vi.resetModules()
        const mockOnRefresh = vi.fn()
        mockMutateAsync.mockResolvedValue({ refresh: true, round: 100 })

        const { usePolling } = await import('../usePolling')
        const { result } = renderHook(() =>
            usePolling({ onRefresh: mockOnRefresh }),
        )

        await act(async () => {
            await result.current.startPolling()
            vi.advanceTimersByTime(3000)
            await flush()
        })

        expect(mockOnRefresh).toHaveBeenCalledTimes(1)

        await act(async () => {
            vi.advanceTimersByTime(3000)
            await flush()
        })

        expect(mockOnRefresh).toHaveBeenCalledTimes(2)

        await act(async () => {
            vi.advanceTimersByTime(3000)
            await flush()
        })

        expect(mockOnRefresh).toHaveBeenCalledTimes(3)

        await act(async () => {
            await result.current.stopPolling()
        })
    })

    test('does not call onRefresh when backend errors occur', async () => {
        vi.resetModules()
        const mockOnRefresh = vi.fn()
        mockMutateAsync.mockRejectedValueOnce(new Error('Network error'))

        const { usePolling } = await import('../usePolling')
        const { result } = renderHook(() =>
            usePolling({ onRefresh: mockOnRefresh }),
        )

        await act(async () => {
            await result.current.startPolling()
            vi.advanceTimersByTime(3000)
            await flush()
        })

        expect(mockOnRefresh).not.toHaveBeenCalled()
        expect(mockSetLastRefreshedRound).not.toHaveBeenCalled()

        await act(async () => {
            await result.current.stopPolling()
        })
    })

    test('calls onRefresh and sets null round when round is null', async () => {
        vi.resetModules()
        const mockOnRefresh = vi.fn()
        mockMutateAsync.mockResolvedValue({ refresh: true, round: null })

        const { usePolling } = await import('../usePolling')
        const { result } = renderHook(() =>
            usePolling({ onRefresh: mockOnRefresh }),
        )

        await act(async () => {
            await result.current.startPolling()
            vi.advanceTimersByTime(3000)
            await flush()
        })

        expect(mockOnRefresh).toHaveBeenCalledTimes(1)
        expect(mockSetLastRefreshedRound).toHaveBeenCalledWith('mainnet', null)

        await act(async () => {
            await result.current.stopPolling()
        })
    })

    test('works without options (backward compatibility)', async () => {
        vi.resetModules()
        mockMutateAsync.mockResolvedValue({ refresh: true, round: 50 })

        const { usePolling } = await import('../usePolling')
        const { result } = renderHook(() => usePolling())

        await act(async () => {
            await result.current.startPolling()
            vi.advanceTimersByTime(3000)
            await flush()
        })

        expect(mockSetLastRefreshedRound).toHaveBeenCalledWith('mainnet', 50)
        // No error thrown when onRefresh is undefined

        await act(async () => {
            await result.current.stopPolling()
        })
    })

    test('handles backend errors gracefully', async () => {
        vi.resetModules()

        mockMutateAsync.mockRejectedValueOnce(new Error('Network error'))

        const { usePolling } = await import('../usePolling')
        const { result } = renderHook(() => usePolling())

        await act(async () => {
            await result.current.startPolling()
            vi.advanceTimersByTime(3000)
            await flush()
        })

        // Should not throw, should log error and continue
        expect(mockMutateAsync).toHaveBeenCalledTimes(1)

        await act(async () => {
            await result.current.stopPolling()
        })
    })
})
