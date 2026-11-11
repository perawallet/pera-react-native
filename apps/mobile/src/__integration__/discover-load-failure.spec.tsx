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

// Discover with the real PWWebView: a page that fails to load ends on an
// error with Reload, and a bridge call that throws is answered, not fatal.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Linking } from 'react-native'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { config } from '@perawallet/wallet-core-config'
import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { WEBVIEW_LOADING_TIMEOUT_MS } from '@modules/webview/components/PWWebView/usePWWebViewLoadState'

type CapturedWebViewProps = {
    source: { uri: string }
    onLoadStart: (event: { nativeEvent: { url: string } }) => void
    onLoad: (event: { nativeEvent: { url: string; title: string } }) => void
    onHttpError: (event: {
        nativeEvent: { url: string; statusCode: number; description: string }
    }) => void
    onMessage: (event: { nativeEvent: { data: string; url: string } }) => void
}

const { captured, webViewMethods, BRIDGE_TOKEN } = vi.hoisted(() => ({
    captured: { props: undefined as CapturedWebViewProps | undefined },
    webViewMethods: {
        reload: undefined as unknown as ReturnType<typeof vi.fn>,
        injectJavaScript: undefined as unknown as ReturnType<typeof vi.fn>,
    },
    BRIDGE_TOKEN: 'discover-load-failure-token',
}))

vi.mock('react-native-webview', async () => {
    const { forwardRef, useImperativeHandle } = await import('react')
    const WebView = forwardRef((props: CapturedWebViewProps, ref) => {
        captured.props = props
        useImperativeHandle(ref, () => webViewMethods)
        return null
    })
    return { default: WebView, WebView }
})

vi.mock('@modules/webview/hooks/handlers', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@modules/webview/hooks/handlers')
    >()),
    generateBridgeToken: () => BRIDGE_TOKEN,
}))

const { DiscoverDetailScreen } =
    await import('@modules/discover/screens/DiscoverDetailScreen/DiscoverDetailScreen')

const webViewProps = (): CapturedWebViewProps => {
    if (!captured.props) throw new Error('WebView not rendered')
    return captured.props
}

const renderDiscover = async () => {
    renderWithNavigation(DiscoverDetailScreen, 'DiscoverDetail', {
        initialParams: { path: 'markets' },
    })
    await waitFor(() => expect(captured.props).toBeDefined())
    return webViewProps().source.uri
}

describe('Flow: Discover — content that fails to load', () => {
    beforeEach(() => {
        captured.props = undefined
        webViewMethods.reload = vi.fn()
        webViewMethods.injectJavaScript = vi.fn()
        vi.mocked(Linking.canOpenURL).mockResolvedValue(false)
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('Given the page never finishes loading, when the load budget runs out, then an error with Reload shows and Reload reloads the page', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        const url = await renderDiscover()

        act(() => webViewProps().onLoadStart({ nativeEvent: { url } }))
        act(() => {
            vi.advanceTimersByTime(WEBVIEW_LOADING_TIMEOUT_MS)
        })

        const timeout = await screen.findByTestId('pw-webview-timeout')
        fireEvent.click(within(timeout).getByText('common.webview.reload'))

        expect(webViewMethods.reload).toHaveBeenCalledTimes(1)
    })

    it('Given the Discover server answers 503, then an error with Reload covers its page and Reload reloads it', async () => {
        const url = await renderDiscover()

        act(() => {
            webViewProps().onLoadStart({ nativeEvent: { url } })
            webViewProps().onHttpError({
                nativeEvent: {
                    url,
                    statusCode: 503,
                    description: 'Service Temporarily Unavailable',
                },
            })
            webViewProps().onLoad({ nativeEvent: { url, title: '503' } })
        })

        const unavailable = await screen.findByTestId('pw-webview-unavailable')
        fireEvent.click(within(unavailable).getByText('common.webview.reload'))

        expect(webViewMethods.reload).toHaveBeenCalledTimes(1)
    })

    it('Given a bridge call whose handler throws, when Discover sends it, then Discover stays up and the page gets an InternalError answer', async () => {
        vi.spyOn(dappRequestChainAdapters, 'get').mockImplementation(() => {
            throw new Error('adapter missing')
        })
        await renderDiscover()

        expect(() =>
            act(() =>
                webViewProps().onMessage({
                    nativeEvent: {
                        url: config.discoverBaseUrl,
                        data: JSON.stringify({
                            id: 'addr-1',
                            jsonrpc: '2.0',
                            method: 'getAddresses',
                            token: BRIDGE_TOKEN,
                        }),
                    },
                }),
            ),
        ).not.toThrow()

        const answers = webViewMethods.injectJavaScript.mock.calls
            .map(call => String(call[0]))
            .join('')
        expect(answers).toContain('"id":"addr-1"')
        expect(answers).toContain('"code":-32603')
    })
})
