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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { onlineManager } from '@tanstack/react-query'
import { reconnectAllConnectors } from '../../connection'
import { useWalletConnectNetworkReconnect } from '../useWalletConnectNetworkReconnect'

vi.mock('../../connection', () => ({
    reconnectAllConnectors: vi.fn(),
}))

const DEBOUNCE_MS = 1000

describe('useWalletConnectNetworkReconnect', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.clearAllMocks()
        onlineManager.setOnline(true)
    })

    afterEach(() => {
        onlineManager.setOnline(true)
        vi.useRealTimers()
    })

    it('sweeps once after an offline→online edge', () => {
        renderHook(() => useWalletConnectNetworkReconnect())

        act(() => onlineManager.setOnline(false))
        expect(reconnectAllConnectors).not.toHaveBeenCalled()

        act(() => {
            onlineManager.setOnline(true)
            vi.advanceTimersByTime(DEBOUNCE_MS)
        })
        expect(reconnectAllConnectors).toHaveBeenCalledTimes(1)
    })

    it('does not sweep on an online→offline edge', () => {
        renderHook(() => useWalletConnectNetworkReconnect())

        act(() => {
            onlineManager.setOnline(false)
            vi.advanceTimersByTime(DEBOUNCE_MS)
        })

        expect(reconnectAllConnectors).not.toHaveBeenCalled()
    })

    it('collapses a flapping link into one sweep once it settles online', () => {
        renderHook(() => useWalletConnectNetworkReconnect())

        act(() => {
            onlineManager.setOnline(false)
            onlineManager.setOnline(true)
            vi.advanceTimersByTime(DEBOUNCE_MS / 2)
            onlineManager.setOnline(false)
            onlineManager.setOnline(true)
            vi.advanceTimersByTime(DEBOUNCE_MS)
        })

        expect(reconnectAllConnectors).toHaveBeenCalledTimes(1)
    })

    it('cancels a pending sweep when the link drops inside the debounce window', () => {
        renderHook(() => useWalletConnectNetworkReconnect())

        act(() => {
            onlineManager.setOnline(false)
            onlineManager.setOnline(true)
            vi.advanceTimersByTime(DEBOUNCE_MS / 2)
            onlineManager.setOnline(false)
            vi.advanceTimersByTime(DEBOUNCE_MS * 2)
        })

        expect(reconnectAllConnectors).not.toHaveBeenCalled()
    })

    it('unsubscribes and cancels the pending sweep on unmount', () => {
        const { unmount } = renderHook(() => useWalletConnectNetworkReconnect())

        act(() => {
            onlineManager.setOnline(false)
            onlineManager.setOnline(true)
        })
        unmount()
        act(() => {
            vi.advanceTimersByTime(DEBOUNCE_MS * 2)
            // A post-unmount edge must not schedule anything either.
            onlineManager.setOnline(false)
            onlineManager.setOnline(true)
            vi.advanceTimersByTime(DEBOUNCE_MS * 2)
        })

        expect(reconnectAllConnectors).not.toHaveBeenCalled()
    })
})
