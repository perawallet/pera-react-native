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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useDeviceIdHandler } from '../useDeviceIdHandler'
import {
    TRUSTED,
    bridgeMessage,
    createMockWebview,
    lastAction,
} from './fixtures'

vi.mock('react-native-webview', () => ({ default: {} }))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: vi.fn(),
}))

describe('useDeviceIdHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useDeviceID).mockReturnValue('device-id')
    })

    it('answers getDeviceId with the action message the Discover web app listens for', () => {
        const webview = createMockWebview()
        const { result } = renderHook(() => useDeviceIdHandler(webview, true))

        result.current(bridgeMessage('gd-1', 'getDeviceId'), TRUSTED)

        expect(lastAction(webview)).toEqual({
            action: 'getDeviceId',
            payload: 'device-id',
        })
    })

    it('stays silent on getDeviceId while the id is unavailable', () => {
        vi.mocked(useDeviceID).mockReturnValue(null)
        const webview = createMockWebview()
        const { result } = renderHook(() => useDeviceIdHandler(webview, true))

        result.current(bridgeMessage('gd-none', 'getDeviceId'), TRUSTED)

        expect(webview.injectJavaScript).not.toHaveBeenCalled()
    })

    it('pushes a device id that lands after mount', () => {
        vi.mocked(useDeviceID).mockReturnValue(null)
        const webview = createMockWebview()
        const { rerender } = renderHook(() => useDeviceIdHandler(webview, true))
        expect(webview.injectJavaScript).not.toHaveBeenCalled()

        vi.mocked(useDeviceID).mockReturnValue('device-id')
        act(() => rerender())

        expect(lastAction(webview)).toEqual({
            action: 'getDeviceId',
            payload: 'device-id',
        })
    })

    it('does not push on the initial mount, which getSettings already covered', () => {
        const webview = createMockWebview()

        renderHook(() => useDeviceIdHandler(webview, true))

        expect(webview.injectJavaScript).not.toHaveBeenCalled()
    })

    it('does not push when the connection is insecure', () => {
        vi.mocked(useDeviceID).mockReturnValue(null)
        const webview = createMockWebview()
        const { rerender } = renderHook(() =>
            useDeviceIdHandler(webview, false),
        )

        vi.mocked(useDeviceID).mockReturnValue('device-id')
        act(() => rerender())

        expect(webview.injectJavaScript).not.toHaveBeenCalled()
    })

    it('does not push while the id remains unavailable', () => {
        vi.mocked(useDeviceID).mockReturnValue(null)
        const webview = createMockWebview()
        const { rerender } = renderHook(() => useDeviceIdHandler(webview, true))

        act(() => rerender())

        expect(webview.injectJavaScript).not.toHaveBeenCalled()
    })
})
