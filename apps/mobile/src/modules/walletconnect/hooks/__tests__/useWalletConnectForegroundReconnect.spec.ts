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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AppState, type AppStateStatus } from 'react-native'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { reconnectAllConnectors } from '@perawallet/wallet-core-walletconnect'
import { useWalletConnectForegroundReconnect } from '../useWalletConnectForegroundReconnect'

vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    reconnectAllConnectors: vi.fn(),
}))

vi.mock('react-native', () => ({
    AppState: {
        currentState: 'active',
        addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
    Platform: { OS: 'android' },
}))

describe('useWalletConnectForegroundReconnect', () => {
    let appStateChangeHandler: Nullable<(next: AppStateStatus) => void> = null
    const removeListener = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        appStateChangeHandler = null
        ;(AppState.addEventListener as Mock).mockImplementation(
            (_event, handler: (next: AppStateStatus) => void) => {
                appStateChangeHandler = handler
                return { remove: removeListener }
            },
        )
    })

    it('reconnects WalletConnect sockets on a background→foreground transition', () => {
        renderHook(() => useWalletConnectForegroundReconnect())

        act(() => appStateChangeHandler?.('background'))
        expect(reconnectAllConnectors).not.toHaveBeenCalled()

        act(() => appStateChangeHandler?.('active'))
        expect(reconnectAllConnectors).toHaveBeenCalledTimes(1)
    })

    it('does not reconnect when the app moves to the background', () => {
        renderHook(() => useWalletConnectForegroundReconnect())

        act(() => appStateChangeHandler?.('background'))

        expect(reconnectAllConnectors).not.toHaveBeenCalled()
    })

    it('removes the AppState listener on unmount', () => {
        const { unmount } = renderHook(() =>
            useWalletConnectForegroundReconnect(),
        )

        unmount()

        expect(removeListener).toHaveBeenCalledTimes(1)
    })
})
