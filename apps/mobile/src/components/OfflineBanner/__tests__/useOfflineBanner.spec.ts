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
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
// Ensure i18n is initialised so t() resolves real strings in this unit env.
import '../../../i18n'
import {
    useNetworkStatusStore,
    useOfflineFeedbackStore,
} from '@modules/network'
import { useOfflineBanner } from '../useOfflineBanner'

// The `@modules/network` barrel also re-exports useNetworkStatusListener,
// which imports the real @react-native-community/netinfo native module —
// that module can't be parsed under vitest/jsdom, so it must be mocked
// (same pattern used in useNetworkStatusListener.spec.ts).
vi.mock('@react-native-community/netinfo', () => ({
    default: {
        addEventListener: vi.fn(),
    },
}))

describe('useOfflineBanner', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        useNetworkStatusStore.setState({ hasInternet: true })
        useOfflineFeedbackStore.setState({ emphasisNonce: 0 })
    })

    afterEach(() => {
        vi.useRealTimers()
        useNetworkStatusStore.setState({ hasInternet: true })
        useOfflineFeedbackStore.setState({ emphasisNonce: 0 })
    })

    it('is hidden when online and idle', () => {
        const { result } = renderHook(() => useOfflineBanner())
        expect(result.current.isVisible).toBe(false)
    })

    it('shows the offline state while there is no internet', () => {
        const { result } = renderHook(() => useOfflineBanner())
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        expect(result.current.isVisible).toBe(true)
        expect(result.current.mode).toBe('offline')
        expect(result.current.label).toBe('Offline Mode')
    })

    it('shows a reconnected state on reconnect, then auto-dismisses after 3s', () => {
        const { result } = renderHook(() => useOfflineBanner())
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: true })
        })
        expect(result.current.isVisible).toBe(true)
        expect(result.current.mode).toBe('reconnected')

        act(() => {
            vi.advanceTimersByTime(3000)
        })
        expect(result.current.isVisible).toBe(false)
    })

    it('cancels the reconnect timer and returns to offline if it drops again', () => {
        const { result } = renderHook(() => useOfflineBanner())
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: true })
        })
        // Drops again during the reconnect window.
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        expect(result.current.mode).toBe('offline')
        expect(result.current.isVisible).toBe(true)

        // Advancing past the old timer must NOT hide the (still-offline) banner.
        act(() => {
            vi.advanceTimersByTime(3000)
        })
        expect(result.current.isVisible).toBe(true)
        expect(result.current.mode).toBe('offline')
    })

    it('is not emphasized on mount', () => {
        const { result } = renderHook(() => useOfflineBanner())
        expect(result.current.isEmphasized).toBe(false)
    })

    it('emphasizes when an offline action requests attention', () => {
        const { result } = renderHook(() => useOfflineBanner())
        act(() => {
            useOfflineFeedbackStore.getState().emphasizeOfflineStatus()
        })
        expect(result.current.isEmphasized).toBe(true)
    })

    it('clears the emphasis after the emphasis window', () => {
        const { result } = renderHook(() => useOfflineBanner())
        act(() => {
            useOfflineFeedbackStore.getState().emphasizeOfflineStatus()
        })
        act(() => {
            vi.advanceTimersByTime(1200)
        })
        expect(result.current.isEmphasized).toBe(false)
    })

    it('restarts the emphasis window instead of stacking timers', () => {
        const { result } = renderHook(() => useOfflineBanner())
        act(() => {
            useOfflineFeedbackStore.getState().emphasizeOfflineStatus()
        })
        act(() => {
            vi.advanceTimersByTime(1000)
        })
        act(() => {
            useOfflineFeedbackStore.getState().emphasizeOfflineStatus()
        })
        // The first window would have expired here; the restart keeps it on.
        act(() => {
            vi.advanceTimersByTime(400)
        })
        expect(result.current.isEmphasized).toBe(true)

        act(() => {
            vi.advanceTimersByTime(800)
        })
        expect(result.current.isEmphasized).toBe(false)
    })

    it('clears the reconnect timer on unmount', () => {
        const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
        const { unmount, rerender } = renderHook(() => useOfflineBanner())
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: true })
        })
        rerender()
        unmount()
        expect(clearSpy).toHaveBeenCalled()
        clearSpy.mockRestore()
    })
})
