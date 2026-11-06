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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// The `@modules/network` barrel re-exports useNetworkStatusListener, which
// imports the NetInfo native module vitest can't parse (same pattern as
// useOfflineBanner.spec.ts).
vi.mock('@react-native-community/netinfo', () => ({
    default: {
        addEventListener: vi.fn(),
    },
}))

import { useNetworkStatusStore } from '@modules/network'
import {
    usePWWebViewLoadState,
    WEBVIEW_LOADING_TIMEOUT_MS,
} from '../usePWWebViewLoadState'

const PAGE_URL = 'https://discover.example/'

describe('usePWWebViewLoadState', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        useNetworkStatusStore.setState({ hasInternet: true })
    })

    afterEach(() => {
        vi.useRealTimers()
        useNetworkStatusStore.setState({ hasInternet: true })
    })

    it('shows the offline surface when mounted offline with no document', () => {
        useNetworkStatusStore.setState({ hasInternet: false })
        const { result } = renderHook(() =>
            usePWWebViewLoadState({ onReload: vi.fn() }),
        )

        expect(result.current.showOfflineView).toBe(true)
        expect(result.current.showTimeoutView).toBe(false)
    })

    it('keeps the loaded document on screen when connectivity drops mid-session', () => {
        const { result } = renderHook(() =>
            usePWWebViewLoadState({ onReload: vi.fn() }),
        )

        act(() => result.current.handleDocumentLoaded(PAGE_URL))
        act(() => useNetworkStatusStore.setState({ hasInternet: false }))

        expect(result.current.showOfflineView).toBe(false)
    })

    it('times the initial load out when the platform never fires an error', () => {
        const { result } = renderHook(() =>
            usePWWebViewLoadState({ onReload: vi.fn() }),
        )

        act(() => result.current.handleLoadStart())
        act(() => vi.advanceTimersByTime(WEBVIEW_LOADING_TIMEOUT_MS + 1))

        expect(result.current.showTimeoutView).toBe(true)
    })

    it('does not time out a load that finished in time', () => {
        const { result } = renderHook(() =>
            usePWWebViewLoadState({ onReload: vi.fn() }),
        )

        act(() => result.current.handleLoadStart())
        act(() => result.current.handleLoadEnd())
        act(() => vi.advanceTimersByTime(WEBVIEW_LOADING_TIMEOUT_MS + 1))

        expect(result.current.showTimeoutView).toBe(false)
    })

    it('reloads exactly once per offline episode when connectivity returns', () => {
        useNetworkStatusStore.setState({ hasInternet: false })
        const onReload = vi.fn()
        renderHook(() => usePWWebViewLoadState({ onReload }))

        act(() => useNetworkStatusStore.setState({ hasInternet: true }))
        expect(onReload).toHaveBeenCalledTimes(1)

        // Same episode: no further reloads until the network drops again.
        act(() => useNetworkStatusStore.setState({ hasInternet: false }))
        act(() => useNetworkStatusStore.setState({ hasInternet: true }))
        expect(onReload).toHaveBeenCalledTimes(2)
    })

    it('never auto-reloads when the session was online all along', () => {
        const onReload = vi.fn()
        renderHook(() => usePWWebViewLoadState({ onReload }))

        expect(onReload).not.toHaveBeenCalled()
    })

    it('handleRetry clears the timeout surface and reloads', () => {
        const onReload = vi.fn()
        const { result } = renderHook(() => usePWWebViewLoadState({ onReload }))

        act(() => result.current.handleLoadStart())
        act(() => vi.advanceTimersByTime(WEBVIEW_LOADING_TIMEOUT_MS + 1))
        expect(result.current.showTimeoutView).toBe(true)

        act(() => result.current.handleRetry())

        expect(result.current.showTimeoutView).toBe(false)
        expect(onReload).toHaveBeenCalledTimes(1)
    })

    it('covers the page when the main frame answers with a 5xx', () => {
        const { result } = renderHook(() =>
            usePWWebViewLoadState({ onReload: vi.fn() }),
        )

        act(() => result.current.handleLoadStart())
        act(() =>
            result.current.handleHttpError({ url: PAGE_URL, statusCode: 503 }),
        )
        act(() => result.current.handleDocumentLoaded(PAGE_URL))

        expect(result.current.showUnavailableView).toBe(true)
    })

    it('leaves a 4xx page to the site', () => {
        const { result } = renderHook(() =>
            usePWWebViewLoadState({ onReload: vi.fn() }),
        )

        act(() =>
            result.current.handleHttpError({ url: PAGE_URL, statusCode: 404 }),
        )
        act(() => result.current.handleDocumentLoaded(PAGE_URL))

        expect(result.current.showUnavailableView).toBe(false)
    })

    it('does not treat the 5xx page as a loaded document', () => {
        const { result } = renderHook(() =>
            usePWWebViewLoadState({ onReload: vi.fn() }),
        )

        act(() =>
            result.current.handleHttpError({ url: PAGE_URL, statusCode: 503 }),
        )
        act(() => result.current.handleDocumentLoaded(PAGE_URL))
        act(() => useNetworkStatusStore.setState({ hasInternet: false }))

        expect(result.current.showOfflineView).toBe(true)
        expect(result.current.showUnavailableView).toBe(false)
    })

    it('handleRetry clears the unavailable surface and reloads', () => {
        const onReload = vi.fn()
        const { result } = renderHook(() => usePWWebViewLoadState({ onReload }))

        act(() =>
            result.current.handleHttpError({ url: PAGE_URL, statusCode: 503 }),
        )
        act(() => result.current.handleRetry())

        expect(result.current.showUnavailableView).toBe(false)
        expect(onReload).toHaveBeenCalledTimes(1)
    })

    it('clears the unavailable surface when a page at another URL loads', () => {
        const { result } = renderHook(() =>
            usePWWebViewLoadState({ onReload: vi.fn() }),
        )

        act(() =>
            result.current.handleHttpError({ url: PAGE_URL, statusCode: 502 }),
        )
        act(() =>
            result.current.handleDocumentLoaded('https://discover.example/a'),
        )

        expect(result.current.showUnavailableView).toBe(false)
    })

    it('keeps the unavailable surface when the loaded URL differs only by fragment', () => {
        const { result } = renderHook(() =>
            usePWWebViewLoadState({ onReload: vi.fn() }),
        )

        act(() =>
            result.current.handleHttpError({ url: PAGE_URL, statusCode: 503 }),
        )
        act(() => result.current.handleDocumentLoaded(`${PAGE_URL}#section`))

        expect(result.current.showUnavailableView).toBe(true)
    })
})
