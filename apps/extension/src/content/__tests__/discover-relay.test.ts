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
import { DISCOVER_BRIDGE_PORT_PREFIX } from '@perawallet/wallet-extension-platform-chrome'

const TOKEN = 'relay-token-1'

type FakePort = {
    name: string
    postMessage: ReturnType<typeof vi.fn>
    onMessage: { addListener: (cb: (data: unknown) => void) => void }
    onDisconnect: { addListener: (cb: () => void) => void }
    emitMessage: (data: unknown) => void
}

let ports: FakePort[]

const makeFakeChrome = () => ({
    runtime: {
        connect: vi.fn(({ name }: { name: string }) => {
            const messageListeners: Array<(data: unknown) => void> = []
            const port: FakePort = {
                name,
                postMessage: vi.fn(),
                onMessage: { addListener: cb => messageListeners.push(cb) },
                onDisconnect: { addListener: () => undefined },
                emitMessage: data => messageListeners.forEach(cb => cb(data)),
            }
            ports.push(port)
            return port
        }),
    },
})

const handshake = (requestEventName: string, responseEventName: string) => {
    window.dispatchEvent(
        new CustomEvent('__pera_discover_handshake__', {
            detail: { requestEventName, responseEventName },
        }),
    )
}

const loadScript = async (): Promise<void> => {
    vi.resetModules()
    await import('../discover-relay')
}

beforeEach(() => {
    ports = []
    vi.stubGlobal('chrome', makeFakeChrome())
    window.history.replaceState(null, '', `/?peraBridgeToken=${TOKEN}`)
})

describe('discover-relay content script', () => {
    it('is inert without the token param', async () => {
        window.history.replaceState(null, '', '/')
        await loadScript()
        expect(ports).toHaveLength(0)
    })

    it('connects a port named with the token and relays page → port', async () => {
        await loadScript()
        expect(ports[0]?.name).toBe(`${DISCOVER_BRIDGE_PORT_PREFIX}${TOKEN}`)

        handshake('req-evt', 'res-evt')
        window.dispatchEvent(
            new CustomEvent('req-evt', {
                detail: { method: 'getSettings', token: TOKEN },
            }),
        )
        expect(ports[0]?.postMessage).toHaveBeenCalledWith({
            method: 'getSettings',
            token: TOKEN,
        })
    })

    it('relays port → page via window.postMessage, preserving strings and objects', async () => {
        await loadScript()
        handshake('req-evt', 'res-evt')

        const received: unknown[] = []
        const listener = (event: MessageEvent): void => {
            received.push(event.data)
        }
        window.addEventListener('message', listener)

        ports[0]?.emitMessage({ id: '1', jsonrpc: '2.0', result: {} })
        ports[0]?.emitMessage('{"action":"getDeviceId","payload":"abc"}')
        await new Promise(resolve => setTimeout(resolve, 0)) // postMessage is async

        window.removeEventListener('message', listener)
        expect(received).toEqual([
            { id: '1', jsonrpc: '2.0', result: {} },
            '{"action":"getDeviceId","payload":"abc"}',
        ])
    })

    it('accepts only the first handshake', async () => {
        await loadScript()
        handshake('req-evt', 'res-evt')
        handshake('evil-evt', 'evil-res')
        window.dispatchEvent(
            new CustomEvent('evil-evt', { detail: { method: 'getAddresses' } }),
        )
        expect(ports[0]?.postMessage).not.toHaveBeenCalled()
    })
})
