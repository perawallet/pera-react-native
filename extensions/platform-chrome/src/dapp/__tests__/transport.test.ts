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

import { describe, expect, it, vi } from 'vitest'
import { createChromeDappTransport } from '../transport'
import { DAPP_HOST_REQUEST_SCOPE, DAPP_HOST_RESPONSE_SCOPE } from '../dapp-wire'

type Listener = (
    message: unknown,
    sender: unknown,
    sendResponse: (r: unknown) => void,
) => boolean | void

const makeChrome = () => {
    const listeners: Listener[] = []
    const sendMessage = vi.fn().mockResolvedValue({ ok: true })
    return {
        listeners,
        sendMessage,
        chrome: {
            runtime: {
                id: 'ext-id',
                getURL: (path: string) => `chrome-extension://ext-id/${path}`,
                sendMessage,
                onMessage: {
                    addListener: (l: Listener) => listeners.push(l),
                    removeListener: (l: Listener) =>
                        listeners.splice(listeners.indexOf(l), 1),
                },
            },
        } as unknown as typeof chrome,
    }
}

const SW_SENDER = {
    id: 'ext-id',
    url: 'chrome-extension://ext-id/background.js',
}
const PAGE_SENDER = {
    id: 'ext-id',
    url: 'https://evil.example/',
    origin: 'https://evil.example',
    tab: { id: 9 },
}
const request = { jsonrpc: '2.0' as const, id: 'r1', method: 'connect' }
const hostRequest = {
    scope: DAPP_HOST_REQUEST_SCOPE,
    origin: 'https://a.example',
    hasUserActivation: true,
    faviconUrl: 'https://a.example/f.ico',
    returnTo: { tabId: 4 },
    request,
}

describe('createChromeDappTransport', () => {
    it('hands a trusted host request to the listener with the stamped context and acks it', () => {
        const { chrome: chromeLike, listeners } = makeChrome()
        const listener = vi.fn()
        createChromeDappTransport({ chromeLike }).onRequest(listener)
        const sendResponse = vi.fn()
        listeners[0](hostRequest, SW_SENDER, sendResponse)
        expect(listener).toHaveBeenCalledWith(
            {
                origin: 'https://a.example',
                hasUserActivation: true,
                faviconUrl: 'https://a.example/f.ico',
            },
            request,
            expect.any(Function),
        )
        expect(sendResponse).toHaveBeenCalledWith({ ok: true })
    })

    it('ignores the same message from a non-extension-page sender', () => {
        const { chrome: chromeLike, listeners } = makeChrome()
        const listener = vi.fn()
        createChromeDappTransport({ chromeLike }).onRequest(listener)
        expect(listeners[0](hostRequest, PAGE_SENDER, vi.fn())).toBe(false)
        expect(listener).not.toHaveBeenCalled()
    })

    it('acks a request whose listener throws synchronously, without propagating', () => {
        const { chrome: chromeLike, listeners } = makeChrome()
        const listener = vi.fn(() => {
            throw new Error('listener preamble exploded')
        })
        createChromeDappTransport({ chromeLike }).onRequest(listener)
        const sendResponse = vi.fn()
        expect(() =>
            listeners[0](hostRequest, SW_SENDER, sendResponse),
        ).not.toThrow()
        expect(sendResponse).toHaveBeenCalledWith({ ok: true })
    })

    it('respond sends a host response addressed to the requesting tab and resolves on ack', async () => {
        const { chrome: chromeLike, listeners, sendMessage } = makeChrome()
        const listener = vi.fn()
        createChromeDappTransport({ chromeLike }).onRequest(listener)
        listeners[0](hostRequest, SW_SENDER, vi.fn())
        const respond = listener.mock.calls[0][2] as (
            r: unknown,
        ) => Promise<void>
        const response = { jsonrpc: '2.0', id: 'r1', result: null }
        await expect(respond(response)).resolves.toBeUndefined()
        expect(sendMessage).toHaveBeenCalledWith({
            scope: DAPP_HOST_RESPONSE_SCOPE,
            origin: 'https://a.example',
            payload: response,
            returnTo: { tabId: 4 },
        })
    })

    it('respond rejects when the service worker does not ack delivery', async () => {
        const { chrome: chromeLike, listeners, sendMessage } = makeChrome()
        sendMessage.mockResolvedValueOnce({ ok: false })
        const listener = vi.fn()
        createChromeDappTransport({ chromeLike }).onRequest(listener)
        listeners[0](hostRequest, SW_SENDER, vi.fn())
        const respond = listener.mock.calls[0][2] as (
            r: unknown,
        ) => Promise<void>
        await expect(
            respond({ jsonrpc: '2.0', id: 'r1', result: null }),
        ).rejects.toThrow()
    })

    it('notify broadcasts without a return address', async () => {
        const { chrome: chromeLike, sendMessage } = makeChrome()
        const notification = {
            jsonrpc: '2.0' as const,
            method: 'disconnect',
            params: {},
        }
        await createChromeDappTransport({ chromeLike }).notify(
            'https://a.example',
            notification,
        )
        expect(sendMessage).toHaveBeenCalledWith({
            scope: DAPP_HOST_RESPONSE_SCOPE,
            origin: 'https://a.example',
            payload: notification,
        })
    })

    it('respond rejects when the tab is gone and the send itself fails', async () => {
        const { chrome: chromeLike, listeners, sendMessage } = makeChrome()
        sendMessage.mockRejectedValueOnce(
            new Error('Receiving end does not exist'),
        )
        const listener = vi.fn()
        createChromeDappTransport({ chromeLike }).onRequest(listener)
        listeners[0](hostRequest, SW_SENDER, vi.fn())
        const respond = listener.mock.calls[0][2] as (
            r: unknown,
        ) => Promise<void>
        await expect(
            respond({ jsonrpc: '2.0', id: 'r1', result: null }),
        ).rejects.toThrow('dapp response was not delivered')
    })

    it('notify is best-effort: an unacked or failed broadcast still resolves', async () => {
        const { chrome: chromeLike, sendMessage } = makeChrome()
        const notification = {
            jsonrpc: '2.0' as const,
            method: 'disconnect',
            params: {},
        }
        const transport = createChromeDappTransport({ chromeLike })
        sendMessage.mockResolvedValueOnce({ ok: false })
        await expect(
            transport.notify('https://a.example', notification),
        ).resolves.toBeUndefined()
        sendMessage.mockRejectedValueOnce(
            new Error('Receiving end does not exist'),
        )
        await expect(
            transport.notify('https://a.example', notification),
        ).resolves.toBeUndefined()
    })

    it('unsubscribing removes the runtime listener', () => {
        const { chrome: chromeLike, listeners } = makeChrome()
        const off = createChromeDappTransport({ chromeLike }).onRequest(vi.fn())
        expect(listeners).toHaveLength(1)
        off()
        expect(listeners).toHaveLength(0)
    })
})
