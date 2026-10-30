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
import { webViewScript } from '../../../utils/webViewScript'
import { PWWebView } from '../PWWebView'

import type { WebViewNativeEvent } from 'react-native-webview/lib/WebViewTypes'

// Narrowed to the fields the handler actually reads, but taken from the real
// event type so the stub can't drift from it.
type CapturedNavState = Pick<WebViewNativeEvent, 'url' | 'loading'>

type CapturedWebViewProps = {
    injectedJavaScript?: string
    injectedJavaScriptBeforeContentLoaded?: string
    onMessage?: (event: { nativeEvent: { data: string; url?: string } }) => void
    onNavigationStateChange?: (navState: CapturedNavState) => void
}

type CapturedGuardOptions = {
    externalNavigation?: { onExternalNavigation: (url: string) => void }
}

const {
    capturedWebViewProps,
    capturedGuardOptions,
    mockPushWebView,
    mockInterfaceHandleMessage,
    mockEip1193,
} = vi.hoisted(() => ({
    capturedWebViewProps: {
        current: undefined as CapturedWebViewProps | undefined,
    },
    capturedGuardOptions: {
        current: undefined as CapturedGuardOptions | undefined,
    },
    mockPushWebView: vi.fn(),
    mockInterfaceHandleMessage: vi.fn(),
    mockEip1193: {
        bridgeToken: '',
        injectedScript: undefined as string | undefined,
        handleMessage: vi.fn(() => false),
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
    usePeraWebviewInterface: () => ({
        handleMessage: mockInterfaceHandleMessage,
    }),
    useWebViewStore: (
        selector: (state: {
            removeWebView: () => void
            pushWebView: typeof mockPushWebView
        }) => unknown,
    ) => selector({ removeWebView: vi.fn(), pushWebView: mockPushWebView }),
}))

vi.mock('../useEip1193Bridge', () => ({
    useEip1193Bridge: (args: { bridgeToken: string }) => {
        mockEip1193.bridgeToken = args.bridgeToken
        return {
            injectedScript: mockEip1193.injectedScript,
            handleMessage: mockEip1193.handleMessage,
            trackNavigation: vi.fn(),
        }
    },
}))

vi.mock('../useWebViewNavigationGuard', () => ({
    useWebViewNavigationGuard: (options: CapturedGuardOptions) => {
        capturedGuardOptions.current = options
        return { onShouldStartLoadWithRequest: () => true }
    },
}))

vi.mock('@hooks/useLanguage')

const renderWebView = () =>
    render(
        <PWWebView
            url='https://good.xyz/landing?q=1'
            enablePeraConnect={false}
            showControls
            showFooterBar={false}
        />,
    )

// lanekeep-ignore-next-line pera/no-module-component-specs reason: covers the webview bridge's security behaviour, which has no hook to move to
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

describe('PWWebView injected scripts', () => {
    const renderWith = (props: { enablePeraConnect: boolean }, extra = {}) =>
        render(
            <PWWebView
                url='https://good.xyz/landing'
                {...props}
                {...extra}
            />,
        )

    it('injects no before-content script, and no bridge in the document-end one, without Pera Connect', () => {
        renderWith({ enablePeraConnect: false })

        const { injectedJavaScript, injectedJavaScriptBeforeContentLoaded } =
            capturedWebViewProps.current ?? {}
        expect(injectedJavaScriptBeforeContentLoaded).toBeUndefined()
        expect(injectedJavaScript).toContain('updateTheme?.(')
        expect(injectedJavaScript).not.toContain('peraMobileInterface')
    })

    it('injects the bridge before content and again at document end with Pera Connect', () => {
        renderWith({ enablePeraConnect: true })

        const { injectedJavaScript, injectedJavaScriptBeforeContentLoaded } =
            capturedWebViewProps.current ?? {}
        expect(injectedJavaScript).toContain('setupPeraMobileInterface')
        expect(injectedJavaScriptBeforeContentLoaded).toContain(
            'setupPeraMobileInterface',
        )
        expect(injectedJavaScriptBeforeContentLoaded).toContain(
            'setupPeraConnect',
        )
        expect(injectedJavaScriptBeforeContentLoaded?.endsWith('true;')).toBe(
            true,
        )
    })

    it('places the caller script between the bridge and the theme update', () => {
        renderWith(
            { enablePeraConnect: true },
            { customJavaScript: webViewScript`window.__custom = 1;` },
        )

        const bundle = capturedWebViewProps.current?.injectedJavaScript ?? ''
        const custom = bundle.indexOf('window.__custom = 1;')
        expect(custom).toBeGreaterThan(bundle.indexOf('setupPeraConnect'))
        expect(custom).toBeLessThan(bundle.indexOf('updateTheme?.('))
    })
})

describe('PWWebView external navigation', () => {
    const renderWithExternalLinks = () =>
        render(
            <PWWebView
                url='https://good.xyz/landing'
                enablePeraConnect={false}
                openExternalLinksInBrowser
            />,
        )

    it('pushes an https target the page navigates away to', () => {
        renderWithExternalLinks()

        capturedGuardOptions.current?.externalNavigation?.onExternalNavigation(
            'https://other.xyz/',
        )

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://other.xyz/',
        })
    })

    it('pushes nothing for an http target', () => {
        renderWithExternalLinks()

        capturedGuardOptions.current?.externalNavigation?.onExternalNavigation(
            'http://evil.xyz/',
        )

        expect(mockPushWebView).not.toHaveBeenCalled()
    })
})

describe('PWWebView EIP-1193 provider', () => {
    const renderWithPeraConnect = () =>
        render(
            <PWWebView
                url='https://good.xyz/landing'
                enablePeraConnect
            />,
        )

    const post = (data: unknown) =>
        capturedWebViewProps.current?.onMessage?.({
            nativeEvent: {
                data: JSON.stringify(data),
                url: 'https://good.xyz/',
            },
        })

    it('injects the provider before content and at document end, after the Pera scripts', () => {
        mockEip1193.injectedScript = '/* eip1193 provider */'
        renderWithPeraConnect()

        const { injectedJavaScript, injectedJavaScriptBeforeContentLoaded } =
            capturedWebViewProps.current ?? {}
        expect(injectedJavaScriptBeforeContentLoaded).toContain(
            '/* eip1193 provider */',
        )
        expect(injectedJavaScript).toContain('/* eip1193 provider */')
        expect(injectedJavaScriptBeforeContentLoaded).toContain(
            'setupPeraConnect',
        )
        mockEip1193.injectedScript = undefined
    })

    it('hands a token-stamped message the provider claims to it, and keeps it from the Pera bridge', () => {
        mockEip1193.handleMessage.mockReturnValueOnce(true)
        renderWithPeraConnect()

        post({ provider: 'eip1193', token: mockEip1193.bridgeToken })

        expect(mockEip1193.handleMessage).toHaveBeenCalledWith(
            expect.objectContaining({ provider: 'eip1193' }),
            'https://good.xyz/',
        )
        expect(mockInterfaceHandleMessage).not.toHaveBeenCalled()
    })

    it('drops a message carrying the wrong token before either handler sees it', () => {
        mockEip1193.handleMessage.mockClear()
        mockInterfaceHandleMessage.mockClear()
        renderWithPeraConnect()

        post({ provider: 'eip1193', token: 'forged' })

        expect(mockEip1193.handleMessage).not.toHaveBeenCalled()
        expect(mockInterfaceHandleMessage).not.toHaveBeenCalled()
    })

    it('still routes a Pera bridge message to the Pera bridge', () => {
        mockInterfaceHandleMessage.mockClear()
        renderWithPeraConnect()

        post({
            jsonrpc: '2.0',
            id: 1,
            method: 'getAddresses',
            token: mockEip1193.bridgeToken,
        })

        expect(mockInterfaceHandleMessage).toHaveBeenCalledTimes(1)
    })
})
