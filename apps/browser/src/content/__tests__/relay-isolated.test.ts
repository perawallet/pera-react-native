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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    DAPP_PAGE_REQUEST_SCOPE,
    DAPP_PAGE_RESPONSE_SCOPE,
    WC_PAGE_PAIR_SCOPE,
} from '@perawallet/wallet-extension-platform-chrome'
import {
    CHANNEL_HANDSHAKE_EVENT,
    CHANNEL_RELAY_READY_EVENT,
    CONNECT_MODAL_PAIR_EVENT,
} from '../channel'

type SendMessageMock = (
    message: unknown,
    callback: (response: unknown) => void,
) => void

type RuntimeListener = (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (ack: unknown) => void,
) => boolean

// Returns whatever the listener passed to sendResponse. An empty array means it
// never answered, which is what makes the SW's tabs.sendMessage promise reject.
const deliver = (
    listener: RuntimeListener,
    message: unknown,
    sender: chrome.runtime.MessageSender,
): unknown[] => {
    const acks: unknown[] = []
    listener(message, sender, ack => acks.push(ack))
    return acks
}

const runtimeListeners: RuntimeListener[] = []

const stubChrome = (
    sendMessage: SendMessageMock | (() => void),
    lastError?: unknown,
): void => {
    runtimeListeners.length = 0
    vi.stubGlobal('chrome', {
        runtime: {
            id: 'ext-id',
            sendMessage,
            lastError,
            onMessage: {
                addListener: vi.fn((listener: RuntimeListener) => {
                    runtimeListeners.push(listener)
                }),
            },
        },
    } as unknown as typeof chrome)
}

const dispatchHandshake = (
    requestEventName: string,
    responseEventName: string,
): void => {
    window.dispatchEvent(
        new CustomEvent(CHANNEL_HANDSHAKE_EVENT, {
            detail: { requestEventName, responseEventName },
        }),
    )
}

const dispatchRequest = (requestEventName: string, id: string): void => {
    window.dispatchEvent(
        new CustomEvent(requestEventName, {
            detail: { id, request: { jsonrpc: '2.0', id, method: 'connect' } },
        }),
    )
}

const collect = (eventName: string): unknown[] => {
    const seen: unknown[] = []
    window.addEventListener(eventName, e =>
        seen.push((e as CustomEvent).detail),
    )
    return seen
}

describe('relay-isolated handshake hardening', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    it('dispatches relay-ready after registering the handshake listener, so a load-order race with MAIN is recoverable', async () => {
        stubChrome(vi.fn<SendMessageMock>())

        const readySeen: unknown[] = []
        window.addEventListener(
            CHANNEL_RELAY_READY_EVENT,
            e => readySeen.push(e),
            { once: true },
        )

        await import('../relay-isolated')

        expect(readySeen.length).toBe(1)

        // Arm this module instance's first-only guard with a throwaway
        // handshake before moving on: `vi.resetModules()` only clears the
        // module cache, it doesn't detach this instance's still-live
        // `window.addEventListener(CHANNEL_HANDSHAKE_EVENT, ...)` from jsdom's
        // shared `window`. Left unarmed, that stale listener would still
        // react to a later test's (differently-named) handshake and register
        // its own request listener alongside the fresh module under test.
        dispatchHandshake('unused-req', 'unused-res')

        vi.unstubAllGlobals()
    })

    it('accepts only the first handshake and ignores a later (forged) one', async () => {
        const sendMessage = vi.fn<SendMessageMock>((_message, callback) => {
            callback({ ok: true })
        })
        stubChrome(sendMessage)

        // Import fresh so the module's top-level `window.addEventListener`
        // handshake registration happens under this test's chrome stub.
        await import('../relay-isolated')

        // First handshake: legitimate MAIN-world script, wins the race
        // because both content scripts run at document_start.
        dispatchHandshake('req1', 'res1')

        dispatchRequest('req1', 'id-1')
        expect(sendMessage).toHaveBeenCalledTimes(1)

        // Second (forged) handshake: a page script dispatching the fixed,
        // page-discoverable CHANNEL_HANDSHAKE_EVENT name to try to hijack
        // the channels. It must be ignored entirely.
        dispatchHandshake('req2', 'res2')

        sendMessage.mockClear()
        dispatchRequest('req2', 'id-2')
        expect(sendMessage).not.toHaveBeenCalled()

        // The original (first) channel must still be live.
        dispatchRequest('req1', 'id-3')
        expect(sendMessage).toHaveBeenCalledTimes(1)

        vi.unstubAllGlobals()
    })

    it('stamps hasUserActivation as read in the isolated world', async () => {
        const sendMessage = vi.fn<SendMessageMock>()
        stubChrome(sendMessage)

        await import('../relay-isolated')
        dispatchHandshake('req-ua', 'res-ua')

        Object.defineProperty(navigator, 'userActivation', {
            value: { isActive: true },
            configurable: true,
        })
        dispatchRequest('req-ua', 'id-1')
        expect(sendMessage).toHaveBeenCalledWith(
            {
                scope: DAPP_PAGE_REQUEST_SCOPE,
                request: { jsonrpc: '2.0', id: 'id-1', method: 'connect' },
                hasUserActivation: true,
            },
            expect.any(Function),
        )

        Object.defineProperty(navigator, 'userActivation', {
            value: { isActive: false },
            configurable: true,
        })
        dispatchRequest('req-ua', 'id-2')
        expect(sendMessage).toHaveBeenLastCalledWith(
            expect.objectContaining({ hasUserActivation: false }),
            expect.any(Function),
        )

        vi.unstubAllGlobals()
    })

    it('dispatches a refusal carried in the ack onto the response channel', async () => {
        const response = {
            jsonrpc: '2.0',
            id: 'id-1',
            error: { code: -32_001, message: 'x' },
        }
        stubChrome(
            vi.fn<SendMessageMock>((_message, callback) => {
                callback({ ok: false, response })
            }),
        )

        await import('../relay-isolated')
        dispatchHandshake('req-refuse', 'res-refuse')

        const seen = collect('res-refuse')
        dispatchRequest('req-refuse', 'id-1')

        expect(seen).toEqual([{ id: 'id-1', response }])

        vi.unstubAllGlobals()
    })

    it('does not dispatch anything for an accepted ack, which is answered later on the response scope', async () => {
        stubChrome(
            vi.fn<SendMessageMock>((_message, callback) => {
                callback({ ok: true })
            }),
        )

        await import('../relay-isolated')
        dispatchHandshake('req-ok', 'res-ok')

        const seen = collect('res-ok')
        dispatchRequest('req-ok', 'id-1')

        expect(seen).toEqual([])

        vi.unstubAllGlobals()
    })

    it('forwards a page response from the service worker, and only for this document origin', async () => {
        stubChrome(vi.fn<SendMessageMock>())

        await import('../relay-isolated')
        dispatchHandshake('req-in', 'res-in')

        const seen = collect('res-in')
        const payload = { jsonrpc: '2.0', id: 'id-1', result: 1 }
        const listener = runtimeListeners[0]

        deliver(
            listener,
            {
                scope: DAPP_PAGE_RESPONSE_SCOPE,
                origin: window.location.origin,
                payload,
            },
            { id: 'ext-id' } as chrome.runtime.MessageSender,
        )
        expect(seen).toEqual([{ id: 'id-1', response: payload }])

        // Another origin's traffic must never surface here, and a sender with
        // a tab is a content script impersonating the service worker.
        deliver(
            listener,
            {
                scope: DAPP_PAGE_RESPONSE_SCOPE,
                origin: 'https://other.example',
                payload,
            },
            { id: 'ext-id' } as chrome.runtime.MessageSender,
        )
        deliver(
            listener,
            {
                scope: DAPP_PAGE_RESPONSE_SCOPE,
                origin: window.location.origin,
                payload,
            },
            { id: 'ext-id', tab: { id: 1 } } as chrome.runtime.MessageSender,
        )
        expect(seen).toHaveLength(1)

        vi.unstubAllGlobals()
    })

    it('acks a response it dispatched, and stays silent for one it rejects', async () => {
        stubChrome(vi.fn<SendMessageMock>())

        await import('../relay-isolated')
        dispatchHandshake('req-ack', 'res-ack')

        const listener = runtimeListeners[0]
        const message = {
            scope: DAPP_PAGE_RESPONSE_SCOPE,
            origin: window.location.origin,
            payload: { jsonrpc: '2.0', id: 'id-1', result: 1 },
        }

        // Without this ack the SW's tabs.sendMessage rejects with "message port
        // closed", the host response route reports the answer as undelivered,
        // and the handler never clears the request's TTL timer.
        expect(
            deliver(listener, message, {
                id: 'ext-id',
            } as chrome.runtime.MessageSender),
        ).toEqual([{ ok: true }])

        expect(
            deliver(listener, { ...message, origin: 'https://other.example' }, {
                id: 'ext-id',
            } as chrome.runtime.MessageSender),
        ).toEqual([])
        expect(
            deliver(listener, message, {
                id: 'other-ext',
            } as chrome.runtime.MessageSender),
        ).toEqual([])

        vi.unstubAllGlobals()
    })

    it('forwards a wallet notification as a notification envelope', async () => {
        stubChrome(vi.fn<SendMessageMock>())

        await import('../relay-isolated')
        dispatchHandshake('req-note', 'res-note')

        const seen = collect('res-note')
        const payload = { jsonrpc: '2.0', method: 'disconnect', params: {} }

        deliver(
            runtimeListeners[0],
            {
                scope: DAPP_PAGE_RESPONSE_SCOPE,
                origin: window.location.origin,
                payload,
            },
            { id: 'ext-id' } as chrome.runtime.MessageSender,
        )

        expect(seen).toEqual([{ notification: payload }])

        vi.unstubAllGlobals()
    })

    it('does not dispatch a response when the SW dies mid-request (lastError set, response undefined), leaving MAIN to time out', async () => {
        const sendMessage = vi.fn<SendMessageMock>((_message, callback) => {
            // Simulate Chrome's actual teardown-mid-call behavior: lastError
            // set, no response payload.
            callback(undefined)
        })
        stubChrome(sendMessage, { message: 'The message port closed' })

        await import('../relay-isolated')

        dispatchHandshake('req-dead', 'res-dead')

        const responsesSeen = collect('res-dead')

        dispatchRequest('req-dead', 'id-dead')

        expect(sendMessage).toHaveBeenCalledTimes(1)
        expect(responsesSeen.length).toBe(0)

        vi.unstubAllGlobals()
    })

    it('forwards a connect-modal pair event to the SW on the page-pair scope, using the callback form', async () => {
        const sendMessage = vi.fn<SendMessageMock>()
        stubChrome(sendMessage)

        await import('../relay-isolated')

        Object.defineProperty(navigator, 'userActivation', {
            value: { isActive: true },
            configurable: true,
        })
        window.dispatchEvent(
            new CustomEvent(CONNECT_MODAL_PAIR_EVENT, {
                detail: { uri: 'wc:topic@1?bridge=b&key=00' },
            }),
        )

        // Callback form (not the promise form), so a no-receiver rejection
        // becomes `lastError` instead of an unhandled promise rejection.
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            {
                scope: WC_PAGE_PAIR_SCOPE,
                uri: 'wc:topic@1?bridge=b&key=00',
                hasUserActivation: true,
            },
            expect.any(Function),
        )

        vi.unstubAllGlobals()
    })

    it('stamps hasUserActivation false on a pair event with no gesture behind it', async () => {
        const sendMessage = vi.fn<SendMessageMock>()
        stubChrome(sendMessage)

        await import('../relay-isolated')

        Object.defineProperty(navigator, 'userActivation', {
            value: { isActive: false },
            configurable: true,
        })
        window.dispatchEvent(
            new CustomEvent(CONNECT_MODAL_PAIR_EVENT, {
                detail: { uri: 'wc:topic@1?bridge=b&key=00' },
            }),
        )

        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({ hasUserActivation: false }),
            expect.any(Function),
        )

        vi.unstubAllGlobals()
    })

    it('ignores a connect-modal pair event with no uri', async () => {
        const sendMessage = vi.fn<SendMessageMock>()
        stubChrome(sendMessage)

        await import('../relay-isolated')

        window.dispatchEvent(
            new CustomEvent(CONNECT_MODAL_PAIR_EVENT, { detail: {} }),
        )
        expect(chrome.runtime.sendMessage).not.toHaveBeenCalled()

        vi.unstubAllGlobals()
    })

    it('does not throw when the SW never calls back and lastError is set (no receiver / dead SW)', async () => {
        const sendMessage = vi.fn<SendMessageMock>((_message, callback) => {
            callback(undefined)
        })
        stubChrome(sendMessage, { message: 'Could not establish connection' })

        await import('../relay-isolated')

        expect(() => {
            window.dispatchEvent(
                new CustomEvent(CONNECT_MODAL_PAIR_EVENT, {
                    detail: { uri: 'wc:topic@1?bridge=b&key=00' },
                }),
            )
        }).not.toThrow()

        vi.unstubAllGlobals()
    })

    it('does not throw when sendMessage itself throws synchronously (extension context invalidated)', async () => {
        const sendMessage = vi.fn(() => {
            throw new Error('Extension context invalidated.')
        })
        stubChrome(sendMessage)

        await import('../relay-isolated')

        expect(() => {
            window.dispatchEvent(
                new CustomEvent(CONNECT_MODAL_PAIR_EVENT, {
                    detail: { uri: 'wc:topic@1?bridge=b&key=00' },
                }),
            )
        }).not.toThrow()

        vi.unstubAllGlobals()
    })
})
