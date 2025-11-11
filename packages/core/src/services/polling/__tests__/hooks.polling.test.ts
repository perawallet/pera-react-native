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
import { MemoryKeyValueStorage, registerTestPlatform } from '@test-utils'
import { reinitializeAppStore } from '@store/app-store'

// Hoisted spy for generated backend mutation hook used by usePolling
const backendSpies = vi.hoisted(() => ({
    mutateAsync: vi.fn(),
}))

// Mock generated hooks and react-query client used inside polling hook
vi.mock('../../../api/generated/backend', () => ({
    useV1AccountsShouldRefreshCreate: () => ({
        mutateAsync: backendSpies.mutateAsync,
    }),
}))
vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ resetQueries: vi.fn() }),
}))

const flush = async () => {
    // allow pending promises/microtasks to flush
    await Promise.resolve()
}

describe('services/polling/usePolling', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        backendSpies.mutateAsync.mockReset()
    })

    test('does not call backend when there are no accounts', async () => {
        vi.resetModules()

        // Provide platform storage for persisted Zustand store
        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: {
                setItem: vi.fn(),
                getItem: vi.fn(),
                removeItem: vi.fn(),
            } as any,
        })

        const { usePolling } = await import('../hooks')
        const { result } = renderHook(() => usePolling())

        await act(async () => {
            await result.current.startPolling()
        })

        act(() => {
            vi.advanceTimersByTime(3000)
        })
        await flush()

        expect(backendSpies.mutateAsync).not.toHaveBeenCalled()

        await act(async () => {
            await result.current.stopPolling()
        })
    })

    test('calls backend with addresses and lastRefreshedRound null', async () => {
        vi.resetModules()

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: {
                setItem: vi.fn(),
                getItem: vi.fn(),
                removeItem: vi.fn(),
            } as any,
        })

        const { useAppStore } = await import('../../../store')
        // seed accounts
        useAppStore
            .getState()
            .setAccounts([
                { id: '1', type: 'standard', address: 'ADDR1' } as any,
            ])

        backendSpies.mutateAsync.mockResolvedValueOnce({ refresh: false })

        const { usePolling } = await import('../hooks')
        const { result } = renderHook(() => usePolling())

        await act(async () => {
            await result.current.startPolling()
        })

        act(() => {
            vi.advanceTimersByTime(3000)
        })
        await flush()

        expect(backendSpies.mutateAsync).toHaveBeenCalledTimes(1)
        const callArg = (backendSpies.mutateAsync as any).mock.calls[0][0]
        expect(callArg).toEqual(
            expect.objectContaining({
                data: expect.objectContaining({
                    account_addresses: ['ADDR1'],
                    last_refreshed_round: null,
                }),
            }),
        )

        await act(async () => {
            await result.current.stopPolling()
        })
    })

    test('updates lastRefreshedRound when backend indicates refresh', async () => {
        vi.resetModules()

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: {
                setItem: vi.fn(),
                getItem: vi.fn(),
                removeItem: vi.fn(),
            } as any,
        })

        const { useAppStore } = await import('../../../store')
        useAppStore
            .getState()
            .setAccounts([
                { id: '2', type: 'standard', address: 'ADDR2' } as any,
            ])
        // seed a previous round
        useAppStore.getState().setLastRefreshedRound(10)

        backendSpies.mutateAsync.mockResolvedValueOnce({
            refresh: true,
            round: 99,
        })

        const { usePolling } = await import('../hooks')
        const { result } = renderHook(() => usePolling())

        await act(async () => {
            await result.current.startPolling()
        })

        act(() => {
            vi.advanceTimersByTime(3000)
        })
        await flush()

        expect(useAppStore.getState().lastRefreshedRound).toBe(99)

        await act(async () => {
            await result.current.stopPolling()
        })
    })

    test('stopPolling prevents further backend calls', async () => {
        vi.resetModules()

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: {
                setItem: vi.fn(),
                getItem: vi.fn(),
                removeItem: vi.fn(),
            } as any,
        })

        const useAppStore = reinitializeAppStore()
        useAppStore
            .getState()
            .setAccounts([
                { id: '3', type: 'standard', address: 'ADDR3' } as any,
            ])

        backendSpies.mutateAsync.mockResolvedValue({ refresh: false })

        const { usePolling } = await import('../hooks')
        const { result } = renderHook(() => usePolling())

        await act(async () => {
            await result.current.startPolling()
        })

        // First tick -> one call
        act(() => {
            vi.advanceTimersByTime(3000)
        })
        await flush()
        expect(backendSpies.mutateAsync).toHaveBeenCalledTimes(1)

        // Stop and ensure no additional calls on further ticks
        await act(async () => {
            await result.current.stopPolling()
        })
        act(() => {
            vi.advanceTimersByTime(9000)
        })
        await flush()
        expect(backendSpies.mutateAsync).toHaveBeenCalledTimes(1)
    })

    test('handles backend errors gracefully', async () => {
        vi.resetModules()

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: {
                setItem: vi.fn(),
                getItem: vi.fn(),
                removeItem: vi.fn(),
            } as any,
        })

        const { useAppStore } = await import('../../../store')
        useAppStore
            .getState()
            .setAccounts([
                { id: '4', type: 'standard', address: 'ADDR4' } as any,
            ])

        backendSpies.mutateAsync.mockRejectedValueOnce(
            new Error('Network error'),
        )

        const { usePolling } = await import('../hooks')
        const { result } = renderHook(() => usePolling())

        await act(async () => {
            await result.current.startPolling()
        })

        act(() => {
            vi.advanceTimersByTime(3000)
        })
        await flush()

        // Should not throw, should log error and continue
        expect(backendSpies.mutateAsync).toHaveBeenCalledTimes(1)

        await act(async () => {
            await result.current.stopPolling()
        })
    })
})
