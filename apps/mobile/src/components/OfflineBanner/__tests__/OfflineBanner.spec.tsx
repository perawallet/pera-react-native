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

import { render, screen, act } from '@test-utils/render'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// Ensure i18n is initialised so t() resolves real strings in this test's module graph.
import '../../../i18n'
import {
    useNetworkStatusStore,
    useOfflineFeedbackStore,
} from '@modules/network'
import {
    OFFLINE_BANNER_COLLAPSE_MS,
    OFFLINE_BANNER_EXPANDED_MS,
} from '@constants/ui'
import { OfflineBanner } from '../OfflineBanner'

const DESCRIPTION =
    'Balances may be out of date and some actions are unavailable until you reconnect.'

// The `@modules/network` barrel also re-exports useNetworkStatusListener,
// which imports the real @react-native-community/netinfo native module —
// that module can't be parsed under vitest/jsdom, so it must be mocked
// (same pattern used in useNetworkStatusListener.spec.ts and useOfflineBanner.spec.ts).
vi.mock('@react-native-community/netinfo', () => ({
    default: {
        addEventListener: vi.fn(),
    },
}))

describe('OfflineBanner', () => {
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

    it('renders the localized offline copy when there is no internet', () => {
        render(<OfflineBanner />)
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        const offline = screen.getByText('Offline Mode')
        expect(offline).toBeTruthy()
        // i18n resolved — not the raw key.
        expect(screen.queryByText('common.offline_mode')).toBeNull()
    })

    it('renders nothing when online and idle', () => {
        render(<OfflineBanner />)
        expect(screen.queryByText('Offline Mode')).toBeNull()
        expect(screen.queryByText('Back online')).toBeNull()
    })

    it('shows the localized reconnected copy after coming back online', () => {
        render(<OfflineBanner />)
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: true })
        })
        expect(screen.getByText('Back online')).toBeTruthy()
    })

    it('shows the explanatory toast when the connection drops', () => {
        render(<OfflineBanner />)
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        expect(screen.getByText(DESCRIPTION)).toBeTruthy()
    })

    it('shrinks to the plain pill after the expanded window', () => {
        render(<OfflineBanner />)
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        act(() => {
            vi.advanceTimersByTime(OFFLINE_BANNER_EXPANDED_MS)
        })
        // The unmount timer is scheduled by an effect after the collapse state
        // lands, so the collapse window must be advanced separately.
        act(() => {
            vi.advanceTimersByTime(OFFLINE_BANNER_COLLAPSE_MS)
        })
        expect(screen.queryByText(DESCRIPTION)).toBeNull()
        expect(screen.getByText('Offline Mode')).toBeTruthy()
    })

    it('re-expands the explanation when an offline action is blocked', () => {
        render(<OfflineBanner />)
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        act(() => {
            vi.advanceTimersByTime(OFFLINE_BANNER_EXPANDED_MS)
        })
        // The unmount timer is scheduled by an effect after the collapse state
        // lands, so the collapse window must be advanced separately.
        act(() => {
            vi.advanceTimersByTime(OFFLINE_BANNER_COLLAPSE_MS)
        })
        expect(screen.queryByText(DESCRIPTION)).toBeNull()

        act(() => {
            useOfflineFeedbackStore.getState().emphasizeOfflineStatus()
        })
        expect(screen.getByText(DESCRIPTION)).toBeTruthy()
    })

    it('never shows the explanation on the reconnected pill', () => {
        render(<OfflineBanner />)
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: false })
        })
        act(() => {
            useNetworkStatusStore.setState({ hasInternet: true })
        })
        expect(screen.getByText('Back online')).toBeTruthy()
        expect(screen.queryByText(DESCRIPTION)).toBeNull()
    })
})
