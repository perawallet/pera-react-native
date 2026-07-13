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

import { renderHook, act } from '@testing-library/react'
import { AppState } from 'react-native'
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useNetworkStatusListener } from '../useNetworkStatusListener'
import { useNetworkStatusStore } from '../useNetworkStatusStore'
import { OFFLINE_DEBOUNCE_MS } from '../../networkStatus'

// Mock dependencies
vi.mock('@react-native-community/netinfo', () => ({
    default: {
        configure: vi.fn(),
        fetch: vi.fn(),
        addEventListener: vi.fn(),
    },
}))

vi.mock('@tanstack/react-query', () => ({
    onlineManager: {
        setOnline: vi.fn(),
    },
}))

const mockShowToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

const netInfoState = (partial: Partial<NetInfoState>): NetInfoState =>
    ({
        isConnected: null,
        isInternetReachable: null,
        ...partial,
    }) as NetInfoState

const emitNetInfo = (state: NetInfoState): void => {
    const callback = vi.mocked(NetInfo.addEventListener).mock.calls[0][0]
    act(() => {
        callback(state)
    })
}

describe('useNetworkStatusListener', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        vi.mocked(NetInfo.addEventListener).mockReturnValue(vi.fn())
        useNetworkStatusStore.setState({ hasInternet: true })
        Object.defineProperty(AppState, 'currentState', {
            value: 'active',
            writable: true,
        })
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('subscribes to NetInfo on mount and unsubscribes on unmount', () => {
        const unsubscribe = vi.fn()
        vi.mocked(NetInfo.addEventListener).mockReturnValue(unsubscribe)

        const { unmount } = renderHook(() => useNetworkStatusListener())

        expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1)

        unmount()
        expect(unsubscribe).toHaveBeenCalledTimes(1)
    })

    it('flips offline on a connected-but-unreachable link after the debounce window', () => {
        renderHook(() => useNetworkStatusListener())

        // Captive portal: link up, internet unreachable.
        emitNetInfo(
            netInfoState({ isConnected: true, isInternetReachable: false }),
        )

        // Not immediately offline — the transition is debounced.
        expect(useNetworkStatusStore.getState().hasInternet).toBe(true)

        act(() => {
            vi.advanceTimersByTime(OFFLINE_DEBOUNCE_MS)
        })
        expect(useNetworkStatusStore.getState().hasInternet).toBe(false)
    })

    it('does not flip offline when reachability is unknown (null)', () => {
        renderHook(() => useNetworkStatusListener())

        emitNetInfo(
            netInfoState({ isConnected: true, isInternetReachable: null }),
        )
        act(() => {
            vi.advanceTimersByTime(OFFLINE_DEBOUNCE_MS)
        })

        expect(useNetworkStatusStore.getState().hasInternet).toBe(true)
    })

    it('comes back online immediately', () => {
        useNetworkStatusStore.setState({ hasInternet: false })
        renderHook(() => useNetworkStatusListener())

        emitNetInfo(
            netInfoState({ isConnected: true, isInternetReachable: true }),
        )

        expect(useNetworkStatusStore.getState().hasInternet).toBe(true)
    })

    it('does not apply a pending offline transition after unmount', () => {
        const { unmount } = renderHook(() => useNetworkStatusListener())

        emitNetInfo(
            netInfoState({ isConnected: true, isInternetReachable: false }),
        )
        unmount()

        act(() => {
            vi.advanceTimersByTime(OFFLINE_DEBOUNCE_MS)
        })
        expect(useNetworkStatusStore.getState().hasInternet).toBe(true)
    })

    it('shows toast when internet is lost and AppState is active', () => {
        useNetworkStatusStore.setState({ hasInternet: true })
        Object.defineProperty(AppState, 'currentState', {
            value: 'active',
            writable: true,
        })

        const { rerender } = renderHook(() => useNetworkStatusListener())

        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        rerender()

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'No Internet Connection',
                type: 'warning',
            }),
            expect.anything(),
        )
    })

    it('does NOT show toast when internet is lost but AppState is background', () => {
        useNetworkStatusStore.setState({ hasInternet: true })
        Object.defineProperty(AppState, 'currentState', {
            value: 'background',
            writable: true,
        })

        const { rerender } = renderHook(() => useNetworkStatusListener())

        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        rerender()

        expect(mockShowToast).not.toHaveBeenCalled()
    })

    it('does NOT show toast when internet is lost but AppState is inactive', () => {
        useNetworkStatusStore.setState({ hasInternet: true })
        Object.defineProperty(AppState, 'currentState', {
            value: 'inactive',
            writable: true,
        })

        const { rerender } = renderHook(() => useNetworkStatusListener())

        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        rerender()

        expect(mockShowToast).not.toHaveBeenCalled()
    })
})
