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

import { renderHook, act } from '@testing-library/react'
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useNetworkStatusListener } from '../useNetworkStatusListener'
import { useNetworkStatusStore } from '@hooks/useNetworkStatusStore'
import { OFFLINE_DEBOUNCE_MS, REACHABILITY_URL } from '../../networkStatus'

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

const mockGetStringValue = vi.fn()
vi.mock('@perawallet/wallet-core-remote-config', () => ({
    RemoteConfigKeys: {
        network_reachability_url: 'network_reachability_url',
    },
    useRemoteConfig: () => ({
        getStringValue: mockGetStringValue,
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
        // Default: Remote Config unset → the hook's fallback is returned.
        mockGetStringValue.mockImplementation((_key, fallback) => fallback)
        useNetworkStatusStore.setState({ hasInternet: true })
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

    it('configures NetInfo reachability with the URL from remote config', () => {
        mockGetStringValue.mockReturnValue('https://pera.test/generate_204')

        renderHook(() => useNetworkStatusListener())

        expect(mockGetStringValue).toHaveBeenCalledWith(
            'network_reachability_url',
            REACHABILITY_URL,
        )
        expect(NetInfo.configure).toHaveBeenCalledWith(
            expect.objectContaining({
                reachabilityUrl: 'https://pera.test/generate_204',
            }),
        )
    })

    it('falls back to the default 204 endpoint when remote config is unset', () => {
        renderHook(() => useNetworkStatusListener())

        expect(NetInfo.configure).toHaveBeenCalledWith(
            expect.objectContaining({ reachabilityUrl: REACHABILITY_URL }),
        )
    })

    it('feeds NetInfo events into the network store', () => {
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
})
