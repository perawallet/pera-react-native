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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNetworkStatusStore } from '@modules/network'
import { useBalanceLineChart } from '../useBalanceLineChart'

const mocks = vi.hoisted(() => ({
    request: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.request }),
}))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const defaultParams = {
    hasData: false,
    isPaused: false,
    isError: false,
    isPending: false,
    isUnavailableOnNetwork: false,
}

describe('useBalanceLineChart', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useNetworkStatusStore.getState().setHasInternet(true)
    })

    it('renders the chart whenever there is data, even paused or errored', () => {
        // Stale data beats every state screen (PERA-4581 branch order).
        const { result } = renderHook(() =>
            useBalanceLineChart({
                ...defaultParams,
                hasData: true,
                isPaused: true,
                isError: true,
            }),
        )

        expect(result.current.renderState).toBe('chart')
    })

    it('renders the unavailable state when the network has no Pera backend', () => {
        const { result } = renderHook(() =>
            useBalanceLineChart({
                ...defaultParams,
                isUnavailableOnNetwork: true,
            }),
        )

        expect(result.current.renderState).toBe('unavailable')
    })

    it('renders unavailable ahead of loading and error — the query is parked pending forever', () => {
        const { result } = renderHook(() =>
            useBalanceLineChart({
                ...defaultParams,
                isUnavailableOnNetwork: true,
                isPending: true,
                isError: true,
            }),
        )

        expect(result.current.renderState).toBe('unavailable')
    })

    it('renders the chart over unavailable when stale data exists', () => {
        const { result } = renderHook(() =>
            useBalanceLineChart({
                ...defaultParams,
                hasData: true,
                isUnavailableOnNetwork: true,
            }),
        )

        expect(result.current.renderState).toBe('chart')
    })

    it('renders the offline state when paused with no data — not the spinner', () => {
        // A paused query keeps isPending true forever; paused must win.
        const { result } = renderHook(() =>
            useBalanceLineChart({
                ...defaultParams,
                isPaused: true,
                isPending: true,
            }),
        )

        expect(result.current.renderState).toBe('offline')
    })

    it('renders the offline state for an errored query while the device is offline', () => {
        useNetworkStatusStore.getState().setHasInternet(false)

        const { result } = renderHook(() =>
            useBalanceLineChart({ ...defaultParams, isError: true }),
        )

        expect(result.current.renderState).toBe('offline')
    })

    it('renders the error state for an errored query while online', () => {
        const { result } = renderHook(() =>
            useBalanceLineChart({ ...defaultParams, isError: true }),
        )

        expect(result.current.renderState).toBe('error')
    })

    it('renders the loading state during a first online fetch', () => {
        const { result } = renderHook(() =>
            useBalanceLineChart({ ...defaultParams, isPending: true }),
        )

        expect(result.current.renderState).toBe('loading')
    })

    it('renders the empty state when the query resolved with no points', () => {
        const { result } = renderHook(() => useBalanceLineChart(defaultParams))

        expect(result.current.renderState).toBe('empty')
    })

    it('dispatches retry while online without opening the offline sheet', () => {
        const onRetry = vi.fn()
        const { result } = renderHook(() =>
            useBalanceLineChart({ ...defaultParams, isError: true, onRetry }),
        )

        result.current.handleRetry?.()

        expect(onRetry).toHaveBeenCalledTimes(1)
        expect(mocks.request).not.toHaveBeenCalled()
    })

    it('explains the situation via a bottom sheet instead of a doomed request while offline', () => {
        useNetworkStatusStore.getState().setHasInternet(false)
        const onRetry = vi.fn()
        const { result } = renderHook(() =>
            useBalanceLineChart({ ...defaultParams, isPaused: true, onRetry }),
        )

        result.current.handleRetry?.()

        expect(onRetry).not.toHaveBeenCalled()
        expect(mocks.request).toHaveBeenCalledTimes(1)
    })

    it('returns no retry handler when onRetry is not provided', () => {
        const { result } = renderHook(() => useBalanceLineChart(defaultParams))

        expect(result.current.handleRetry).toBeUndefined()
    })
})
