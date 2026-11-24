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
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview'
import { config } from '@perawallet/wallet-core-config'
import { usePeraWebviewInterface } from '@modules/webview/hooks/usePeraWebviewInterface'
import { usePWWebView, type PWWebViewProps } from '../usePWWebView'

const mocks = vi.hoisted(() => ({
    removeWebView: vi.fn(),
    pushWebView: vi.fn(),
    handleMessage: vi.fn(),
    pair: vi.fn(async () => ({
        type: 'session',
        pairingId: 'fixture-pairing',
    })),
}))

vi.mock('react-native-webview', () => ({
    WebView: (props: Record<string, unknown>) =>
        React.createElement('div', props),
}))

vi.mock('@modules/webview/hooks', () => ({
    useContextFingerprints: () => ({}),
    usePeraWebviewInterface: (
        ...args: Parameters<typeof usePeraWebviewInterface>
    ) => {
        const bridge = usePeraWebviewInterface(...args)
        return {
            handleMessage: (
                ...message: Parameters<typeof bridge.handleMessage>
            ) => {
                mocks.handleMessage(...message)
                bridge.handleMessage(...message)
            },
        }
    },
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

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@hooks/useCapability', async () =>
    (await import('@test-utils/capability-mock')).capabilityHookMock(),
)

vi.mock('@modules/connections', async importOriginal => ({
    ...(await importOriginal<typeof import('@modules/connections')>()),
    useConnectionPairing: () => ({ pair: mocks.pair, describeUri: vi.fn() }),
}))

vi.mock('@modules/webview/hooks/bridge/useExternalUriHandlers', () => ({
    useExternalUriHandlers: () => ({
        openSystemBrowser: vi.fn(),
        canOpenURI: vi.fn(),
        openNativeURI: vi.fn(),
    }),
}))

vi.mock('@modules/webview/hooks/bridge/useTransactionSigningHandler', () => ({
    useTransactionSigningHandler: () => vi.fn(),
}))

vi.mock('@modules/webview/hooks/bridge/useDataSigningHandler', () => ({
    useDataSigningHandler: () => vi.fn(),
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

    it.each([
        [
            'v1',
            'wc:fixture-topic@1?bridge=https%3A%2F%2Fbridge.example&key=' +
                'a'.repeat(64),
        ],
        [
            'v2',
            'wc:' +
                'b'.repeat(64) +
                '@2?relay-protocol=irn&symKey=' +
                'c'.repeat(64),
        ],
    ])(
        'saves a %s pairing under the posting frame while the page navigates away',
        async (_, uri) => {
            const url = new URL('/discover/landing', config.discoverBaseUrl)
            const frameUrl = new URL('/discover/pairing', url).href
            const { result } = renderHook(() =>
                usePWWebView({ url: url.href, enablePeraConnect: true }),
            )
            const webViewProps = () =>
                (
                    result.current.renderWebView() as React.ReactElement<WebViewProps>
                ).props
            act(() => {
                webViewProps().onNavigationStateChange?.({
                    url: 'https://evil.example/',
                    loading: true,
                } as Parameters<
                    NonNullable<WebViewProps['onNavigationStateChange']>
                >[0])
            })
            const props = webViewProps()
            const token = /var __peraBridgeToken = "([^"]+)";/.exec(
                props.injectedJavaScriptBeforeContentLoaded ?? '',
            )?.[1]
            expect(token).toBeDefined()
            const request = {
                id: 'pair',
                jsonrpc: '2.0',
                method: 'walletConnect',
                params: { uri },
                token,
            }

            await act(async () => {
                props.onMessage?.({
                    nativeEvent: {
                        data: JSON.stringify(request),
                        url: frameUrl,
                    },
                } as WebViewMessageEvent)
            })

            expect(mocks.handleMessage).toHaveBeenCalledExactlyOnceWith(
                request,
                {
                    securedConnection: true,
                    sourceUrl: frameUrl,
                },
            )
            expect(mocks.pair).toHaveBeenCalledExactlyOnceWith(uri, {
                origin: {
                    source: 'in-app',
                    requesterOrigin: new URL(frameUrl).origin,
                },
            })
        },
    )
})
