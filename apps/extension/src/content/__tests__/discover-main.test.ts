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

// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiscoverChannelHandshake } from '@perawallet/wallet-extension-platform-chrome'

declare global {
    interface Window {
        peraMobileInterface?: Record<string, unknown>
        peraRPC?: {
            sendJsonRPCMessage: (request: string) => void
            sendRNMessage: (action: string, params?: unknown) => void
        }
    }
}

const TOKEN = 'test-token-123'

const loadScript = async (): Promise<void> => {
    vi.resetModules()
    await import('../discover-main')
}

const captureHandshake = (): { handshake?: DiscoverChannelHandshake } => {
    const captured: { handshake?: DiscoverChannelHandshake } = {}
    window.addEventListener('__pera_discover_handshake__', event => {
        captured.handshake = (
            event as CustomEvent<DiscoverChannelHandshake>
        ).detail
    })
    return captured
}

beforeEach(() => {
    delete window.peraMobileInterface
    delete window.peraRPC
    window.history.replaceState(null, '', `/?peraBridgeToken=${TOKEN}`)
})

describe('discover-main content script', () => {
    it('is inert without the bridge token param', async () => {
        window.history.replaceState(null, '', '/')
        await loadScript()
        expect(window.peraMobileInterface).toBeUndefined()
        expect(window.peraRPC).toBeUndefined()
    })

    it('installs the native-parity interface surface', async () => {
        await loadScript()
        const iface = window.peraMobileInterface
        expect(iface?.version).toBe('2')
        for (const method of [
            'handleRequest',
            'pushWebView',
            'openSystemBrowser',
            'canOpenURI',
            'openNativeURI',
            'notifyUser',
            'getAddresses',
            'getDeviceId',
            'getSettings',
            'getPublicSettings',
            'onBackPressed',
            'logAnalyticsEvent',
            'closeWebView',
            'pushDappViewerScreen',
            'getAuthorizedAddresses',
        ]) {
            expect(typeof iface?.[method], method).toBe('function')
        }
    })

    it('stamps the token and relays JSON-RPC over the handshaken channel', async () => {
        const captured = captureHandshake()
        await loadScript()
        expect(captured.handshake).toBeDefined()

        const received: unknown[] = []
        window.addEventListener(captured.handshake!.requestEventName, event =>
            received.push((event as CustomEvent).detail),
        )
        window.peraRPC!.sendJsonRPCMessage(
            JSON.stringify({ id: '1', jsonrpc: '2.0', method: 'getSettings' }),
        )
        expect(received).toEqual([
            { id: '1', jsonrpc: '2.0', method: 'getSettings', token: TOKEN },
        ])
    })

    it('pushDappViewerScreen aliases to a pushWebView message', async () => {
        const captured = captureHandshake()
        await loadScript()
        const received: Array<{ method: string; params: unknown }> = []
        window.addEventListener(captured.handshake!.requestEventName, event =>
            received.push((event as CustomEvent).detail as never),
        )
        ;(
            window.peraMobileInterface!.pushDappViewerScreen as (
                p: string,
            ) => void
        )(JSON.stringify({ url: 'https://dapp.example', title: 'Dapp' }))
        expect(received[0]?.method).toBe('pushWebView')
        expect(received[0]?.params).toEqual({
            url: 'https://dapp.example',
            title: 'Dapp',
        })
    })

    it('window.open with a wc: uri is intercepted into a walletConnect message', async () => {
        const captured = captureHandshake()
        await loadScript()
        const received: Array<{ method: string; params: unknown }> = []
        window.addEventListener(captured.handshake!.requestEventName, event =>
            received.push((event as CustomEvent).detail as never),
        )
        window.open('wc:abc123@2?relay-protocol=irn')
        expect(received[0]?.method).toBe('walletConnect')
        expect(received[0]?.params).toEqual({
            uri: 'wc:abc123@2?relay-protocol=irn',
        })
    })
})
