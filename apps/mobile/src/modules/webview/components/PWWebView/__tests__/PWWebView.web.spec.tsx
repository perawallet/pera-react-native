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
import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@test-utils/render'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type WebView from 'react-native-webview'

const {
    handleMessage,
    createDiscoverBridgeHost,
    openExternalTab,
    showToast,
    hostParams,
    hostPost,
    useNotifyWebViewOnContextChange,
} = vi.hoisted(() => ({
    handleMessage: vi.fn(),
    createDiscoverBridgeHost: vi.fn(),
    openExternalTab: vi.fn(),
    showToast: vi.fn(),
    hostPost: vi.fn(),
    useNotifyWebViewOnContextChange: vi.fn(),
    hostParams: {} as {
        current?: {
            token: string
            trustedOrigins: string[]
            onMessage: (data: unknown) => void
            onDisconnect?: () => void
        }
    },
}))

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    createDiscoverBridgeHost: createDiscoverBridgeHost.mockImplementation(
        params => {
            hostParams.current = params
            return {
                post: hostPost,
                isConnected: () => true,
                dispose: vi.fn(),
            }
        },
    ),
    openExternalTab,
}))
vi.mock('../../../hooks/usePeraWebviewInterface', () => ({
    usePeraWebviewInterface: () => ({ handleMessage }),
}))
vi.mock('../../../hooks/useNotifyWebViewOnContextChange', () => ({
    useNotifyWebViewOnContextChange,
}))
vi.mock('../../../hooks/useContextFingerprints', () => ({
    useContextFingerprints: () => ({ settings: 's', accounts: 'a' }),
}))
vi.mock('@hooks/useToast', () => ({ useToast: () => ({ showToast }) }))
// M8: the helper (trusted-iframe-origins.web) reads both networks' Bidali
// base via getNetworkConfig — mocked here alongside config so PWWebView.web's
// isSecure/trustedOrigins derivation resolves the same way real config would.
vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        discoverBaseUrl: 'https://discover-mobile-staging.perawallet.app/',
    },
    getNetworkConfig: (network: string) => ({
        bidaliBaseUrl:
            network === 'mainnet'
                ? 'https://commerce.bidali.com/dapp'
                : 'https://commerce.staging.bidali.com/dapp',
    }),
    Networks: { mainnet: 'mainnet', testnet: 'testnet' },
}))

import { asBridgeTransport } from '../../../hooks/handlers.web'
import { PWWebView } from '../PWWebView.web'

const DISCOVER = 'https://discover-mobile-staging.perawallet.app/'
const BIDALI_MAINNET = 'https://commerce.bidali.com/dapp?key=test'

// The mounted host's token — stamped into the iframe src and required on
// every inbound message.
const mountedToken = (): string => hostParams.current!.token

const renderDiscover = () =>
    render(
        <PWWebView
            url={DISCOVER}
            enablePeraConnect={true}
        />,
    )

beforeEach(() => {
    vi.clearAllMocks()
    hostParams.current = undefined
})

describe('PWWebView.web', () => {
    it('renders an iframe whose src carries the bridge token param', () => {
        const { container } = renderDiscover()
        const src = container.querySelector('iframe')?.getAttribute('src')
        expect(src).toContain('peraBridgeToken=')
        expect(src).toContain(mountedToken())
        expect(hostParams.current?.trustedOrigins).toEqual([
            'https://discover-mobile-staging.perawallet.app',
        ])
    })

    // M8: Bidali mounts trust both the configured commerce origin and its
    // giftcards.-prefixed 302-redirect twin (trusted-iframe-origins.web.ts).
    it('creates the host with the commerce + giftcards origin pair for a Bidali mount', () => {
        render(
            <PWWebView
                url={BIDALI_MAINNET}
                enablePeraConnect={true}
            />,
        )
        expect(createDiscoverBridgeHost).toHaveBeenCalledTimes(1)
        expect(hostParams.current?.trustedOrigins).toEqual([
            'https://commerce.bidali.com',
            'https://giftcards.bidali.com',
        ])
    })

    // M8: an unrecognized mount gets no bridge at all — getTrustedIframeOrigins
    // returns [] and PWWebView.web must not stand up a host nothing could ever
    // authenticate a port against.
    it('does not create a bridge host for an unrecognized URL', () => {
        render(
            <PWWebView
                url='https://untrusted.example.com/'
                enablePeraConnect={true}
            />,
        )
        expect(createDiscoverBridgeHost).not.toHaveBeenCalled()
    })

    it('routes a valid bridge message into the native handler registry', () => {
        renderDiscover()
        const message = {
            id: '1',
            jsonrpc: '2.0',
            method: 'getSettings',
            token: mountedToken(),
        }
        hostParams.current!.onMessage(message)
        expect(handleMessage).toHaveBeenCalledWith(message, {
            securedConnection: true,
            sourceUrl: DISCOVER,
        })
    })

    it('drops messages with a wrong bridge token', () => {
        renderDiscover()
        hostParams.current!.onMessage({
            id: '1',
            jsonrpc: '2.0',
            method: 'getSettings',
            token: 'forged',
        })
        expect(handleMessage).not.toHaveBeenCalled()
    })

    it('intercepts pushWebView into a real browser tab', () => {
        renderDiscover()
        hostParams.current!.onMessage({
            id: '2',
            jsonrpc: '2.0',
            method: 'pushWebView',
            params: { url: 'https://dapp.example', title: 'Dapp' },
            token: mountedToken(),
        })
        expect(openExternalTab).toHaveBeenCalledWith('https://dapp.example')
        expect(handleMessage).not.toHaveBeenCalled()
    })

    // M7: the toast stub is gone — walletConnect ops fall through to the
    // shared registry (openWalletConnect), which drives real pairing.
    it('routes walletConnect ops into the native handler registry, not a toast', () => {
        renderDiscover()
        const message = {
            id: '3',
            jsonrpc: '2.0',
            method: 'walletConnect',
            params: { uri: 'wc:x@2' },
            token: mountedToken(),
        }
        hostParams.current!.onMessage(message)
        expect(handleMessage).toHaveBeenCalledWith(message, {
            securedConnection: true,
            sourceUrl: DISCOVER,
        })
        expect(showToast).not.toHaveBeenCalled()
    })

    it('routes to onCustomMessage before any gating when provided', () => {
        const onCustomMessage = vi.fn()
        render(
            <PWWebView
                url={DISCOVER}
                enablePeraConnect={false}
                onCustomMessage={onCustomMessage}
            />,
        )
        hostParams.current!.onMessage({ anything: true })
        expect(onCustomMessage).toHaveBeenCalledWith({ anything: true })
        expect(handleMessage).not.toHaveBeenCalled()
    })

    it('drops bridge messages when enablePeraConnect is false', () => {
        render(
            <PWWebView
                url={DISCOVER}
                enablePeraConnect={false}
            />,
        )
        hostParams.current!.onMessage({
            id: '4',
            jsonrpc: '2.0',
            method: 'getSettings',
            token: mountedToken(),
        })
        expect(handleMessage).not.toHaveBeenCalled()
    })

    // Controller correction (Task 4 review adjudication): the MAIN-world
    // bridge calls are fire-and-forget with no client timeout, and the
    // relay's port is persistent — if the port dies mid-life (extension
    // reload, host disposal) every future bridge call silently vanishes for
    // the iframe's lifetime unless the component notices and remounts with a
    // fresh token + fresh host.
    it('remounts with a fresh bridge token and a fresh host when the bridge port disconnects', () => {
        const { container } = renderDiscover()
        const firstToken = mountedToken()
        const firstOnDisconnect = hostParams.current!.onDisconnect
        expect(firstOnDisconnect).toBeTypeOf('function')

        act(() => {
            firstOnDisconnect!()
        })

        expect(createDiscoverBridgeHost).toHaveBeenCalledTimes(2)
        const secondToken = mountedToken()
        expect(secondToken).not.toBe(firstToken)

        const src = container.querySelector('iframe')?.getAttribute('src')
        expect(src).toContain(secondToken)
        expect(src).not.toContain(firstToken)
    })

    // Review finding 1 (M6) / M8 update: every other privileged op runs
    // through requireSecure inside usePeraWebviewInterface; the web-only
    // pushWebView intercept must too, rather than trusting the token check
    // alone. Previously this was exercised by mounting an untrusted URL and
    // pushing a message straight through the (fully mocked) host — but M8
    // makes host creation itself conditional on trust (see "does not create
    // a bridge host for an unrecognized URL" above), so a host existing
    // for an insecure mount is no longer a reachable state to construct
    // against the real helper; requireSecure's success path stays covered by
    // "intercepts pushWebView into a real browser tab" above, and its
    // isSecure-gating logic has direct unit coverage in handlers-shared's
    // own spec.

    // Fix 1 (M6 final-review): native (PWWebView.tsx:122-124) passes
    // `enablePeraConnect ? contextFingerprints : undefined` into the notify
    // hook so a false-gated mount (future M8 gift-cards path) never triggers
    // onHostContextChanged. The web twin must match exactly.
    it('gates contextFingerprints on enablePeraConnect, matching native', () => {
        renderDiscover() // enablePeraConnect: true
        expect(useNotifyWebViewOnContextChange).toHaveBeenLastCalledWith(
            expect.anything(),
            { settings: 's', accounts: 'a' },
            true,
        )

        render(
            <PWWebView
                url={DISCOVER}
                enablePeraConnect={false}
            />,
        )
        expect(useNotifyWebViewOnContextChange).toHaveBeenLastCalledWith(
            expect.anything(),
            undefined,
            true,
        )
    })

    // M8 Task 2: the incoming webviewRef prop (used by e.g. useBidaliTransport
    // to reach webview.current?.injectJavaScript on native) must be populated
    // on web with this mount's transport-backed twin so the same ref works on
    // both platforms — bidali-events.web.ts recovers the transport back out
    // via asBridgeTransport and posts through it.
    it('populates the incoming webviewRef with a transport-backed bridge webview, and nulls it on unmount', () => {
        const webviewRef = {
            current: null,
        } as React.RefObject<Nullable<WebView>>

        const { unmount } = render(
            <PWWebView
                url={DISCOVER}
                enablePeraConnect={true}
                webviewRef={webviewRef}
            />,
        )

        expect(webviewRef.current).not.toBeNull()
        asBridgeTransport(webviewRef.current)?.postToWebview({ hello: 'world' })
        expect(hostPost).toHaveBeenCalledWith({ hello: 'world' })

        unmount()
        expect(webviewRef.current).toBeNull()
    })

    // Review finding 2: a crash-looping relay must not drive the
    // disconnect → regenerate-token → reconnect → disconnect… cycle forever.
    it('bounds disconnect-driven reloads instead of looping forever', () => {
        renderDiscover()
        const seenTokens = new Set<string>([mountedToken()])

        for (let i = 0; i < 5; i += 1) {
            const onDisconnect = hostParams.current!.onDisconnect!
            act(() => {
                onDisconnect()
            })
            seenTokens.add(mountedToken())
        }

        // 1 initial host + at most 3 reload-created hosts (MAX_RAPID_RECONNECTS)
        // despite 5 disconnects firing.
        expect(createDiscoverBridgeHost).toHaveBeenCalledTimes(4)
        expect(seenTokens.size).toBe(4)
    })
})
