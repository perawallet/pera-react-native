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
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'
import { useNetworkStatusListener } from '../useNetworkStatusListener'
import { useNetworkStatusStore } from '../useNetworkStatusStore'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('@react-native-community/netinfo', () => ({
    default: { addEventListener: vi.fn() },
}))

vi.mock('@tanstack/react-query', () => ({
    onlineManager: { setOnline: vi.fn() },
}))

const mockShowToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

describe('useNetworkStatusListener', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useNetworkStatusStore.setState({ hasInternet: true })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('subscribes to NetInfo updates and updates store and onlineManager', () => {
        const mockUnsubscribe = vi.fn()
        const mockAddEventListener = vi.mocked(NetInfo.addEventListener)
        mockAddEventListener.mockReturnValue(mockUnsubscribe)

        renderHook(() => useNetworkStatusListener())

        expect(mockAddEventListener).toHaveBeenCalledTimes(1)

        const networkCallback = mockAddEventListener.mock.calls[0][0]
        act(() => {
            networkCallback({ isConnected: false } as NetInfoState)
        })
        expect(useNetworkStatusStore.getState().hasInternet).toBe(false)
        expect(onlineManager.setOnline).toHaveBeenCalledWith(false)

        act(() => {
            networkCallback({ isConnected: true } as NetInfoState)
        })
        expect(useNetworkStatusStore.getState().hasInternet).toBe(true)
        expect(onlineManager.setOnline).toHaveBeenCalledWith(true)
    })

    it('does not show a toast when internet is lost (banner supersedes it)', () => {
        const mockAddEventListener = vi.mocked(NetInfo.addEventListener)
        mockAddEventListener.mockReturnValue(vi.fn())

        const { rerender } = renderHook(() => useNetworkStatusListener())
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        rerender()

        expect(mockShowToast).not.toHaveBeenCalled()
    })
})
