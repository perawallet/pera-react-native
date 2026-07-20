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
import { renderHook, act } from '@testing-library/react'

// The `@modules/network` barrel re-exports useNetworkStatusListener, which
// imports the NetInfo native module vitest can't parse (same pattern as
// useOfflineBanner.spec.ts).
vi.mock('@react-native-community/netinfo', () => ({
    default: {
        addEventListener: vi.fn(),
    },
}))

const mockShowToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useNetworkStatusStore } from '@modules/network'
import { usePWRefreshControl } from '../usePWRefreshControl'

describe('usePWRefreshControl', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useNetworkStatusStore.setState({ hasInternet: true })
    })

    it('dispatches the refresh when online', () => {
        const onRefresh = vi.fn()
        const { result } = renderHook(() => usePWRefreshControl({ onRefresh }))

        act(() => result.current.handleRefresh())

        expect(onRefresh).toHaveBeenCalledTimes(1)
        expect(mockShowToast).not.toHaveBeenCalled()
    })

    it('short-circuits an offline pull into an explicit hint instead of a silent no-op', () => {
        useNetworkStatusStore.setState({ hasInternet: false })
        const onRefresh = vi.fn()
        const { result } = renderHook(() => usePWRefreshControl({ onRefresh }))

        act(() => result.current.handleRefresh())

        // An offline refetch would park as a paused query: the spinner
        // dismisses instantly with no data change and no feedback.
        expect(onRefresh).not.toHaveBeenCalled()
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'common.offline_mode',
                type: 'info',
            }),
        )
    })
})
