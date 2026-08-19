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
import {
    OFFLINE_BANNER_COLLAPSE_MS,
    OFFLINE_BANNER_EXPANDED_MS,
    OFFLINE_BANNER_REEXPANDED_MS,
} from '@constants/ui'
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

    it('resolves the localized explanatory description', () => {
        const { result } = renderHook(() => useOfflineBanner())
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        expect(result.current.description).not.toBe('')
        expect(result.current.description).not.toBe(
            'common.offline_mode_description',
        )
    })

    it('starts expanded when the connection drops', () => {
        const { result } = renderHook(() => useOfflineBanner())
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        expect(result.current.isExpanded).toBe(true)
    })

    it('collapses to the pill after the expanded window', () => {
        const { result } = renderHook(() => useOfflineBanner())
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        act(() => {
            vi.advanceTimersByTime(OFFLINE_BANNER_EXPANDED_MS)
        })
        expect(result.current.isExpanded).toBe(false)
    })

    it('re-expands when an offline action requests attention, then collapses again', () => {
        const { result } = renderHook(() => useOfflineBanner())
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        act(() => {
            vi.advanceTimersByTime(OFFLINE_BANNER_EXPANDED_MS)
        })
        expect(result.current.isExpanded).toBe(false)

        act(() => {
            useOfflineFeedbackStore.getState().emphasizeOfflineStatus()
        })
        expect(result.current.isExpanded).toBe(true)

        act(() => {
            vi.advanceTimersByTime(OFFLINE_BANNER_REEXPANDED_MS)
        })
        expect(result.current.isExpanded).toBe(false)
    })

    it('restarts the re-expansion window instead of stacking timers', () => {
        const { result } = renderHook(() => useOfflineBanner())
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        act(() => {
            vi.advanceTimersByTime(OFFLINE_BANNER_EXPANDED_MS)
        })
        act(() => {
            useOfflineFeedbackStore.getState().emphasizeOfflineStatus()
        })
        act(() => {
            vi.advanceTimersByTime(OFFLINE_BANNER_REEXPANDED_MS - 1000)
        })
        act(() => {
            useOfflineFeedbackStore.getState().emphasizeOfflineStatus()
        })
        // The first window would have expired here; the restart keeps it open.
        act(() => {
            vi.advanceTimersByTime(1500)
        })
        expect(result.current.isExpanded).toBe(true)

        act(() => {
            vi.advanceTimersByTime(OFFLINE_BANNER_REEXPANDED_MS - 1500)
        })
        expect(result.current.isExpanded).toBe(false)
    })

    it('does not expand while online', () => {
        const { result } = renderHook(() => useOfflineBanner())
        act(() => {
            useOfflineFeedbackStore.getState().emphasizeOfflineStatus()
        })
        expect(result.current.isExpanded).toBe(false)
    })

    it('is never expanded in the reconnected state', () => {
        const { result } = renderHook(() => useOfflineBanner())
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        // Reconnect before the expanded window elapses.
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: true })
        })
        expect(result.current.mode).toBe('reconnected')
        expect(result.current.isExpanded).toBe(false)
    })

    it('keeps the explanation mounted through the collapse animation, then unmounts it', () => {
        const { result } = renderHook(() => useOfflineBanner())
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        expect(result.current.isExplanationRendered).toBe(true)

        act(() => {
            vi.advanceTimersByTime(OFFLINE_BANNER_EXPANDED_MS)
        })
        // Collapsed, but still mounted so the fade-out is visible.
        expect(result.current.isExpanded).toBe(false)
        expect(result.current.isExplanationRendered).toBe(true)

        act(() => {
            vi.advanceTimersByTime(OFFLINE_BANNER_COLLAPSE_MS)
        })
        expect(result.current.isExplanationRendered).toBe(false)
    })

    it('expands again on a later offline episode', () => {
        const { result } = renderHook(() => useOfflineBanner())
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        act(() => {
            vi.advanceTimersByTime(OFFLINE_BANNER_EXPANDED_MS)
        })
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: true })
        })
        act(() => {
            vi.advanceTimersByTime(3000)
        })
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        expect(result.current.isExpanded).toBe(true)
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
