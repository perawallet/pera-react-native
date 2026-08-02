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
import { WC_PAGE_PAIR_SCOPE } from '@perawallet/wallet-extension-platform-chrome'
import {
    CHANNEL_HANDSHAKE_EVENT,
    CHANNEL_RELAY_READY_EVENT,
    CONNECT_MODAL_PAIR_EVENT,
} from '../channel'

type SendMessageMock = (
    message: unknown,
    callback: (response: unknown) => void,
) => void

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
            detail: { id, request: { reference: 'arc0027:discover:request' } },
        }),
    )
}

describe('relay-isolated handshake hardening', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    it('dispatches relay-ready after registering the handshake listener, so a load-order race with MAIN is recoverable', async () => {
        vi.stubGlobal('chrome', {
            runtime: {
                sendMessage: vi.fn<SendMessageMock>(),
                lastError: undefined as unknown,
            },
        } as unknown as typeof chrome)

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
        vi.stubGlobal('chrome', {
            runtime: {
                sendMessage,
                lastError: undefined as unknown,
            },
        } as unknown as typeof chrome)

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

    it('does not dispatch a response when the SW dies mid-request (lastError set, response undefined), leaving MAIN to time out', async () => {
        const sendMessage = vi.fn<SendMessageMock>((_message, callback) => {
            // Simulate Chrome's actual teardown-mid-call behavior: lastError
            // set, no response payload.
            callback(undefined)
        })
        vi.stubGlobal('chrome', {
            runtime: {
                sendMessage,
                lastError: { message: 'The message port closed' },
            },
        } as unknown as typeof chrome)

        await import('../relay-isolated')

        dispatchHandshake('req-dead', 'res-dead')

        const responsesSeen: unknown[] = []
        window.addEventListener('res-dead', e => responsesSeen.push(e))

        dispatchRequest('req-dead', 'id-dead')

        expect(sendMessage).toHaveBeenCalledTimes(1)
        expect(responsesSeen.length).toBe(0)

        vi.unstubAllGlobals()
    })

    it('forwards a connect-modal pair event to the SW on the page-pair scope, using the callback form', async () => {
        const sendMessage = vi.fn<SendMessageMock>()
        vi.stubGlobal('chrome', {
            runtime: {
                sendMessage,
                lastError: undefined as unknown,
            },
        } as unknown as typeof chrome)

        await import('../relay-isolated')

        window.dispatchEvent(
            new CustomEvent(CONNECT_MODAL_PAIR_EVENT, {
                detail: { uri: 'wc:topic@1?bridge=b&key=00' },
            }),
        )

        // Callback form (not the promise form), so a no-receiver rejection
        // becomes `lastError` instead of an unhandled promise rejection.
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                scope: WC_PAGE_PAIR_SCOPE,
                uri: 'wc:topic@1?bridge=b&key=00',
            }),
            expect.any(Function),
        )

        vi.unstubAllGlobals()
    })

    it('ignores a connect-modal pair event with no uri', async () => {
        const sendMessage = vi.fn<SendMessageMock>()
        vi.stubGlobal('chrome', {
            runtime: {
                sendMessage,
                lastError: undefined as unknown,
            },
        } as unknown as typeof chrome)

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
        vi.stubGlobal('chrome', {
            runtime: {
                sendMessage,
                lastError: { message: 'Could not establish connection' },
            },
        } as unknown as typeof chrome)

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
        vi.stubGlobal('chrome', {
            runtime: {
                sendMessage,
                lastError: undefined as unknown,
            },
        } as unknown as typeof chrome)

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
