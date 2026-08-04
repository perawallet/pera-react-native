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

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    useNetworkStatusStore,
    useOfflineFeedbackStore,
} from '@modules/network'
import { usePWRefreshControl } from '../usePWRefreshControl'

// The `@modules/network` barrel also re-exports useNetworkStatusListener,
// which imports the real @react-native-community/netinfo native module —
// that module can't be parsed under vitest/jsdom, so it must be mocked.
vi.mock('@react-native-community/netinfo', () => ({
    default: {
        addEventListener: vi.fn(),
    },
}))

describe('usePWRefreshControl', () => {
    beforeEach(() => {
        useNetworkStatusStore.setState({ hasInternet: true })
        useOfflineFeedbackStore.setState({ emphasisNonce: 0 })
    })

    afterEach(() => {
        useNetworkStatusStore.setState({ hasInternet: true })
        useOfflineFeedbackStore.setState({ emphasisNonce: 0 })
    })

    it('runs the refresh when online', () => {
        const onRefresh = vi.fn()
        const { result } = renderHook(() =>
            usePWRefreshControl({ isRefreshing: false, onRefresh }),
        )

        act(() => {
            result.current.handleRefresh()
        })

        expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it('emphasizes the offline status instead of refreshing when offline', () => {
        const onRefresh = vi.fn()
        const { result } = renderHook(() =>
            usePWRefreshControl({ isRefreshing: false, onRefresh }),
        )
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })

        act(() => {
            result.current.handleRefresh()
        })

        expect(onRefresh).not.toHaveBeenCalled()
        expect(useOfflineFeedbackStore.getState().emphasisNonce).toBe(1)
    })

    it('reports no refresh in progress while offline', () => {
        const { result } = renderHook(() =>
            usePWRefreshControl({ isRefreshing: true, onRefresh: vi.fn() }),
        )
        expect(result.current.isRefreshing).toBe(true)

        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })

        expect(result.current.isRefreshing).toBe(false)
    })
})
