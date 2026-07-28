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

import type { WebViewNativeEvent } from 'react-native-webview/lib/WebViewTypes'

// Narrowed to the fields the handler actually reads, but taken from the real
// event type so the stub can't drift from it.
type CapturedNavState = Pick<WebViewNativeEvent, 'url' | 'loading'>

type CapturedWebViewProps = {
    onNavigationStateChange?: (navState: CapturedNavState) => void
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
                loading: false,
            })
        })

        expect(screen.getByText('evil.xyz')).toBeTruthy()
        expect(screen.queryByText('good.xyz')).toBeNull()
    })

    it('does not move the label to a navigation that has not committed', () => {
        // A 204 / attachment response leaves the user on the current page. An
        // eager label would name the target and hand a page the frozen-host
        // spoof back in mirror image.
        renderWebView()

        act(() => {
            capturedWebViewProps.current?.onNavigationStateChange?.({
                url: 'https://perawallet.app/looks-legit',
                loading: true,
            })
        })

        expect(screen.getByText('good.xyz')).toBeTruthy()
        expect(screen.queryByText('perawallet.app')).toBeNull()
    })

    it('labels an opaque origin explicitly instead of rendering a blank host', () => {
        // `about:blank` + document.write() lets a page pick the title; leaving
        // the origin line empty reads as "no claim", not "unattributable".
        renderWebView()

        act(() => {
            capturedWebViewProps.current?.onNavigationStateChange?.({
                url: 'about:blank',
                loading: false,
            })
        })

        // `t` returns the key under test setup.
        expect(screen.getByText('common.webview.unknown_host')).toBeTruthy()
        expect(screen.queryByText('good.xyz')).toBeNull()
    })
})
