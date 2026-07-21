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
import { describe, it, expect, vi } from 'vitest'
import { render, act, screen } from '@test-utils/render'
import { PWWebView } from '../PWWebView'

type CapturedWebViewProps = {
    onNavigationStateChange?: (navState: { url: string }) => void
}

const { capturedWebViewProps } = vi.hoisted(() => ({
    capturedWebViewProps: {
        current: undefined as CapturedWebViewProps | undefined,
    },
}))

vi.mock('react-native-webview', () => ({
    WebView: (props: CapturedWebViewProps) => {
        capturedWebViewProps.current = props
        return React.createElement('div', { 'data-testid': 'webview' })
    },
}))

vi.mock('@modules/webview/hooks', () => ({
    useContextFingerprints: () => ({}),
    usePeraWebviewInterface: () => ({ handleMessage: vi.fn() }),
    useWebViewStore: (
        selector: (state: { removeWebView: () => void }) => unknown,
    ) => selector({ removeWebView: vi.fn() }),
}))

vi.mock('../useWebViewNavigationGuard', () => ({
    useWebViewNavigationGuard: () => ({
        onShouldStartLoadWithRequest: () => true,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const renderWebView = () =>
    render(
        <PWWebView
            url='https://good.xyz/landing?q=1'
            enablePeraConnect={false}
            showControls
            showFooterBar={false}
        />,
    )

describe('PWWebView title bar host', () => {
    it('shows the opened url host before any navigation event', () => {
        renderWebView()

        expect(screen.getByText('good.xyz')).toBeTruthy()
    })

    it('tracks the live navigated url after a navigation to another origin', () => {
        renderWebView()

        act(() => {
            capturedWebViewProps.current?.onNavigationStateChange?.({
                url: 'https://evil.xyz/phish',
            })
        })

        expect(screen.getByText('evil.xyz')).toBeTruthy()
        expect(screen.queryByText('good.xyz')).toBeNull()
    })
})
