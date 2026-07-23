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

const defaultParams = {
    hasData: false,
    isPaused: false,
    isError: false,
    isPending: false,
}

describe('useBalanceLineChart', () => {
    beforeEach(() => {
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

    it('dispatches retry while online', () => {
        const onRetry = vi.fn()
        const { result } = renderHook(() =>
            useBalanceLineChart({ ...defaultParams, isError: true, onRetry }),
        )

        result.current.handleRetry?.()

        expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('short-circuits retry while offline instead of dispatching a doomed request', () => {
        useNetworkStatusStore.getState().setHasInternet(false)
        const onRetry = vi.fn()
        const { result } = renderHook(() =>
            useBalanceLineChart({ ...defaultParams, isPaused: true, onRetry }),
        )

        result.current.handleRetry?.()

        expect(onRetry).not.toHaveBeenCalled()
    })

    it('returns no retry handler when onRetry is not provided', () => {
        const { result } = renderHook(() => useBalanceLineChart(defaultParams))

        expect(result.current.handleRetry).toBeUndefined()
    })
})
