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
            trustedOrigin: string
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
vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        discoverBaseUrl: 'https://discover-mobile-staging.perawallet.app/',
    },
}))

import { PWWebView } from '../PWWebView.web'

const DISCOVER = 'https://discover-mobile-staging.perawallet.app/'

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
        expect(hostParams.current?.trustedOrigin).toBe(
            'https://discover-mobile-staging.perawallet.app',
        )
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
        expect(handleMessage).toHaveBeenCalledWith(message)
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
        expect(handleMessage).toHaveBeenCalledWith(message)
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

    // Review finding 1: every other privileged op runs through requireSecure
    // inside usePeraWebviewInterface; the web-only pushWebView intercept must
    // too, rather than trusting the token check alone.
    it('gates pushWebView through requireSecure — an insecure connection gets Unauthorized, not a tab-open', () => {
        const untrustedUrl = 'https://untrusted.example.com/'
        render(
            <PWWebView
                url={untrustedUrl}
                enablePeraConnect={true}
            />,
        )
        const token = mountedToken()

        hostParams.current!.onMessage({
            id: '5',
            jsonrpc: '2.0',
            method: 'pushWebView',
            params: { url: 'https://dapp.example' },
            token,
        })

        expect(openExternalTab).not.toHaveBeenCalled()
        expect(hostPost).toHaveBeenCalledWith({
            id: '5',
            jsonrpc: '2.0',
            error: {
                code: -32_001, // JsonRpcErrorCode.Unauthorized
                message: 'Operation not permitted from this origin',
            },
        })
    })

    // Fix 1 (M6 final-review): native (PWWebView.tsx:122-124) passes
    // `enablePeraConnect ? contextFingerprints : undefined` into the notify
    // hook so a false-gated mount (future M8 gift-cards path) never triggers
    // onHostContextChanged. The web twin must match exactly.
    it('gates contextFingerprints on enablePeraConnect, matching native', () => {
        renderDiscover() // enablePeraConnect: true
        expect(useNotifyWebViewOnContextChange).toHaveBeenLastCalledWith(
            expect.anything(),
            { settings: 's', accounts: 'a' },
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
        )
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
