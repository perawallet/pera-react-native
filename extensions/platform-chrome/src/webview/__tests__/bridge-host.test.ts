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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDiscoverBridgeHost } from '../bridge-host'
import { WEBVIEW_BRIDGE_PORT_PREFIX } from '../bridge-wire'

type Listener = (port: FakePort) => void

type FakePort = {
    name: string
    sender?: { origin?: string }
    onMessage: { addListener: (cb: (data: unknown) => void) => void }
    onDisconnect: { addListener: (cb: () => void) => void }
    postMessage: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
    emitMessage: (data: unknown) => void
    emitDisconnect: () => void
}

const makePort = (name: string, origin?: string): FakePort => {
    const messageListeners: Array<(data: unknown) => void> = []
    const disconnectListeners: Array<() => void> = []
    return {
        name,
        sender: { origin },
        onMessage: { addListener: cb => messageListeners.push(cb) },
        onDisconnect: { addListener: cb => disconnectListeners.push(cb) },
        postMessage: vi.fn(),
        disconnect: vi.fn(),
        emitMessage: data => messageListeners.forEach(cb => cb(data)),
        emitDisconnect: () => disconnectListeners.forEach(cb => cb()),
    }
}

let connectListeners: Listener[]

beforeEach(() => {
    connectListeners = []
    vi.stubGlobal('chrome', {
        runtime: {
            onConnect: {
                addListener: (cb: Listener) => connectListeners.push(cb),
                removeListener: (cb: Listener) => {
                    connectListeners = connectListeners.filter(l => l !== cb)
                },
            },
        },
    })
})

const TRUSTED = 'https://discover-mobile-staging.perawallet.app'

describe('createDiscoverBridgeHost', () => {
    it('accepts a port with matching token and trusted origin, and relays both ways', () => {
        const onMessage = vi.fn()
        const host = createDiscoverBridgeHost({
            token: 'tok1',
            trustedOrigins: [TRUSTED],
            onMessage,
        })
        const port = makePort(`${WEBVIEW_BRIDGE_PORT_PREFIX}tok1`, TRUSTED)
        connectListeners.forEach(cb => cb(port))

        expect(host.isConnected()).toBe(true)
        port.emitMessage({ method: 'getSettings' })
        expect(onMessage).toHaveBeenCalledWith({ method: 'getSettings' })
        host.post({ jsonrpc: '2.0', result: {} })
        expect(port.postMessage).toHaveBeenCalledWith({
            jsonrpc: '2.0',
            result: {},
        })
    })

    it('rejects a port whose sender origin is not the Discover origin', () => {
        const host = createDiscoverBridgeHost({
            token: 'tok1',
            trustedOrigins: [TRUSTED],
            onMessage: vi.fn(),
        })
        const evil = makePort(
            `${WEBVIEW_BRIDGE_PORT_PREFIX}tok1`,
            'https://evil.example',
        )
        connectListeners.forEach(cb => cb(evil))
        expect(evil.disconnect).toHaveBeenCalled()
        expect(host.isConnected()).toBe(false)
    })

    it('ignores ports for other tokens (another mount/surface)', () => {
        const host = createDiscoverBridgeHost({
            token: 'tok1',
            trustedOrigins: [TRUSTED],
            onMessage: vi.fn(),
        })
        const other = makePort(`${WEBVIEW_BRIDGE_PORT_PREFIX}tok2`, TRUSTED)
        connectListeners.forEach(cb => cb(other))
        expect(host.isConnected()).toBe(false)
        expect(other.disconnect).not.toHaveBeenCalled()
    })

    // M8: multi-origin support (Bidali's commerce config origin plus its
    // giftcards.-prefixed redirect twin — see trusted-iframe-origins.web.ts).
    it('accepts a port whose sender origin is the second entry of a multi-origin trust list', () => {
        const onMessage = vi.fn()
        const TWIN = 'https://giftcards.bidali.com'
        const host = createDiscoverBridgeHost({
            token: 'tok1',
            trustedOrigins: ['https://commerce.bidali.com', TWIN],
            onMessage,
        })
        const port = makePort(`${WEBVIEW_BRIDGE_PORT_PREFIX}tok1`, TWIN)
        connectListeners.forEach(cb => cb(port))

        expect(host.isConnected()).toBe(true)
        port.emitMessage({ method: 'getSettings' })
        expect(onMessage).toHaveBeenCalledWith({ method: 'getSettings' })
    })

    it('still rejects a port whose origin is not in a multi-origin trust list', () => {
        const host = createDiscoverBridgeHost({
            token: 'tok1',
            trustedOrigins: [
                'https://commerce.bidali.com',
                'https://giftcards.bidali.com',
            ],
            onMessage: vi.fn(),
        })
        const evil = makePort(
            `${WEBVIEW_BRIDGE_PORT_PREFIX}tok1`,
            'https://evil.example',
        )
        connectListeners.forEach(cb => cb(evil))
        expect(evil.disconnect).toHaveBeenCalled()
        expect(host.isConnected()).toBe(false)
    })

    // Fix 2 (M6 final-review): an iframe self-reload with the same token can
    // have the new port connect before the old port's disconnect event
    // fires. The old port is superseded, not the active one, so its later
    // disconnect must not tear down the connection the new port established.
    it('ignores a disconnect from a superseded port once a newer port has connected', () => {
        const onDisconnect = vi.fn()
        const host = createDiscoverBridgeHost({
            token: 'tok1',
            trustedOrigins: [TRUSTED],
            onMessage: vi.fn(),
            onDisconnect,
        })
        const oldPort = makePort(`${WEBVIEW_BRIDGE_PORT_PREFIX}tok1`, TRUSTED)
        connectListeners.forEach(cb => cb(oldPort))
        const newPort = makePort(`${WEBVIEW_BRIDGE_PORT_PREFIX}tok1`, TRUSTED)
        connectListeners.forEach(cb => cb(newPort))

        expect(host.isConnected()).toBe(true)
        oldPort.emitDisconnect()

        expect(onDisconnect).not.toHaveBeenCalled()
        expect(host.isConnected()).toBe(true)

        host.post({ jsonrpc: '2.0', result: {} })
        expect(newPort.postMessage).toHaveBeenCalledWith({
            jsonrpc: '2.0',
            result: {},
        })
    })

    // Fix 2 (M6 final-review): messages arriving on a superseded port must
    // not be forwarded — only the currently active port's messages count.
    it('ignores messages arriving on a superseded port', () => {
        const onMessage = vi.fn()
        const host = createDiscoverBridgeHost({
            token: 'tok1',
            trustedOrigins: [TRUSTED],
            onMessage,
        })
        const oldPort = makePort(`${WEBVIEW_BRIDGE_PORT_PREFIX}tok1`, TRUSTED)
        connectListeners.forEach(cb => cb(oldPort))
        const newPort = makePort(`${WEBVIEW_BRIDGE_PORT_PREFIX}tok1`, TRUSTED)
        connectListeners.forEach(cb => cb(newPort))

        oldPort.emitMessage({ method: 'stale' })
        expect(onMessage).not.toHaveBeenCalled()

        newPort.emitMessage({ method: 'fresh' })
        expect(onMessage).toHaveBeenCalledWith({ method: 'fresh' })
        expect(onMessage).toHaveBeenCalledTimes(1)
    })

    it('post() is a safe no-op after disconnect; dispose unregisters', () => {
        const host = createDiscoverBridgeHost({
            token: 'tok1',
            trustedOrigins: [TRUSTED],
            onMessage: vi.fn(),
        })
        const port = makePort(`${WEBVIEW_BRIDGE_PORT_PREFIX}tok1`, TRUSTED)
        connectListeners.forEach(cb => cb(port))
        port.emitDisconnect()
        expect(host.isConnected()).toBe(false)
        expect(() => host.post({})).not.toThrow()
        host.dispose()
        expect(connectListeners).toHaveLength(0)
    })
})
