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

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePWWebView, type PWWebViewProps } from '../usePWWebView'

const mocks = vi.hoisted(() => ({
    removeWebView: vi.fn(),
    pushWebView: vi.fn(),
    handleMessage: vi.fn(),
}))

vi.mock('react-native-webview', () => ({
    WebView: (props: Record<string, unknown>) =>
        React.createElement('div', props),
}))

vi.mock('@modules/webview/hooks', () => ({
    useContextFingerprints: () => ({}),
    usePeraWebviewInterface: () => ({ handleMessage: mocks.handleMessage }),
    useWebViewStore: (
        selector: (state: {
            removeWebView: typeof mocks.removeWebView
            pushWebView: typeof mocks.pushWebView
        }) => unknown,
    ) =>
        selector({
            removeWebView: mocks.removeWebView,
            pushWebView: mocks.pushWebView,
        }),
}))

vi.mock('@modules/webview/hooks/useNotifyWebViewOnContextChange', () => ({
    useNotifyWebViewOnContextChange: vi.fn(),
}))

vi.mock('../useWebViewNavigationGuard', () => ({
    useWebViewNavigationGuard: () => ({
        onShouldStartLoadWithRequest: () => true,
    }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    usePeraProvider: () => ({
        deviceInfo: {
            getDevicePlatform: () => 'ios',
            getAppVersion: () => '1.0.0',
            getUserAgent: () => 'Mozilla/5.0',
        },
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const baseProps: PWWebViewProps = {
    url: 'https://good.xyz/landing',
    enablePeraConnect: false,
}

describe('usePWWebView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('starts on the url it was given', () => {
        const { result } = renderHook(() => usePWWebView(baseProps))

        expect(result.current.committedUrl).toBe('https://good.xyz/landing')
    })

    it('closes the caller when no request is tracked', () => {
        const onClose = vi.fn()
        const { result } = renderHook(() =>
            usePWWebView({ ...baseProps, onClose }),
        )

        act(() => result.current.onCloseRequested())

        expect(onClose).toHaveBeenCalled()
        expect(mocks.removeWebView).not.toHaveBeenCalled()
    })

    it('removes the tracked web view when the request is known', () => {
        const { result } = renderHook(() =>
            usePWWebView({ ...baseProps, requestId: 'request-1' }),
        )

        act(() => result.current.onCloseRequested())

        expect(mocks.removeWebView).toHaveBeenCalledWith('request-1')
    })

    it('loads the url it was given', () => {
        const { result } = renderHook(() => usePWWebView(baseProps))

        const element = result.current.renderWebView()

        expect(element.props).toEqual(
            expect.objectContaining({
                source: { uri: 'https://good.xyz/landing' },
            }),
        )
    })
})
