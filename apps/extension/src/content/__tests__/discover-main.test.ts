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
    // Swap in a fresh <body>: each loadScript() attaches a new
    // MutationObserver to document.body and nothing ever disconnects the
    // previous test's observer. Without this, a stale observer (registered
    // earlier, so its callback runs first) still reacts to this test's DOM
    // mutations and can win the race to consume/remove a modal before the
    // current test's own observer and message channel see it. Detaching the
    // old body node stops old observers from seeing further mutations.
    const freshBody = document.createElement('body')
    document.documentElement.replaceChild(freshBody, document.body)
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

    // Parity with native peraConnectJS (injected-scripts.ts): MAX_URI_LENGTH
    // cap, DEDUP_WINDOW_MS dedup, perawallet-wc: scheme, and modal scraping.
    describe('WC-URI hook parity', () => {
        const listenForMessages = (
            captured: ReturnType<typeof captureHandshake>,
        ): Array<{ method: string; params: unknown }> => {
            const received: Array<{ method: string; params: unknown }> = []
            window.addEventListener(
                captured.handshake!.requestEventName,
                event => received.push((event as CustomEvent).detail as never),
            )
            return received
        }

        it('dedups an identical wc: URI within the dedup window', async () => {
            const captured = captureHandshake()
            await loadScript()
            const received = listenForMessages(captured)

            const uri = 'wc:abc@1?bridge=https%3A%2F%2Fb.example&key=k'
            window.open(uri)
            window.open(uri)

            const wcMessages = received.filter(
                m => m.method === 'walletConnect',
            )
            expect(wcMessages).toHaveLength(1)
            expect(wcMessages[0]?.params).toEqual({ uri })
        })

        it('drops oversized URIs', async () => {
            const captured = captureHandshake()
            await loadScript()
            const received = listenForMessages(captured)

            // MAX_URI_LENGTH is 4096 (copied from injected-scripts.ts).
            const oversized = `wc:${'a'.repeat(4096)}`
            window.open(oversized)

            expect(
                received.filter(m => m.method === 'walletConnect'),
            ).toHaveLength(0)
        })

        it('accepts perawallet-wc: scheme', async () => {
            const captured = captureHandshake()
            await loadScript()
            const received = listenForMessages(captured)

            const uri = 'perawallet-wc:def@2?relay-protocol=irn&key=k2'
            window.open(uri)

            const wcMessages = received.filter(
                m => m.method === 'walletConnect',
            )
            expect(wcMessages).toHaveLength(1)
            expect(wcMessages[0]?.params).toEqual({ uri })
        })

        it('scrapes the connect modal and suppresses the redirect modal', async () => {
            const captured = captureHandshake()
            await loadScript()
            const received = listenForMessages(captured)

            const redirect = document.createElement('div')
            redirect.id = 'pera-wallet-redirect-modal-wrapper'
            document.body.appendChild(redirect)

            await Promise.resolve()

            expect(
                document.getElementById('pera-wallet-redirect-modal-wrapper'),
            ).toBeNull()
            expect(
                received.filter(m => m.method === 'walletConnect'),
            ).toHaveLength(0)

            const connect = document.createElement('div')
            connect.id = 'pera-wallet-connect-modal-wrapper'
            const modal = document.createElement('pera-wallet-connect-modal')
            modal.setAttribute(
                'uri',
                'wc:ghi@3?relay-protocol=irn&algorand=true',
            )
            connect.appendChild(modal)
            document.body.appendChild(connect)

            await Promise.resolve()

            const wcMessages = received.filter(
                m => m.method === 'walletConnect',
            )
            expect(wcMessages).toHaveLength(1)
            expect(wcMessages[0]?.params).toEqual({
                uri: 'wc:ghi@3?relay-protocol=irn&algorand=true',
            })
            expect(
                document.getElementById('pera-wallet-connect-modal-wrapper'),
            ).toBeNull()
        })
    })
})
