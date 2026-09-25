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
import { WEBAUTHN_CHANNEL_HANDSHAKE_EVENT } from '../channel'
import { SETTINGS_STORE_KV_KEY } from '../webauthn-toggle'

type SendMessageMock = (
    message: unknown,
    callback: (response: unknown) => void,
) => void

const dispatchHandshake = (
    requestEventName: string,
    responseEventName: string,
): void => {
    window.dispatchEvent(
        new CustomEvent(WEBAUTHN_CHANNEL_HANDSHAKE_EVENT, {
            detail: { requestEventName, responseEventName },
        }),
    )
}

const dispatchRequest = (
    requestEventName: string,
    id: string,
    request: unknown = { kind: 'create', origin: 'https://x.com', options: {} },
): void => {
    window.dispatchEvent(
        new CustomEvent(requestEventName, { detail: { id, request } }),
    )
}

const stubChrome = (opts: {
    storageRaw?: string
    sendMessage?: SendMessageMock
}) => {
    const storageGet = vi.fn(async () =>
        opts.storageRaw === undefined
            ? {}
            : { [SETTINGS_STORE_KV_KEY]: opts.storageRaw },
    )
    const sendMessage = vi.fn<SendMessageMock>(
        opts.sendMessage ??
            ((_message, callback) => callback({ decline: true })),
    )
    vi.stubGlobal('chrome', {
        storage: { local: { get: storageGet } },
        runtime: { sendMessage, lastError: undefined as unknown },
    } as unknown as typeof chrome)
    return { storageGet, sendMessage }
}

describe('webauthn-relay', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    it('toggle OFF: answers with an immediate decline and never calls chrome.runtime.sendMessage', async () => {
        const { sendMessage } = stubChrome({
            storageRaw:
                '{"state":{"preferences":{"webauthnInterceptionEnabled":false}}}',
        })
        await import('../webauthn-relay')

        dispatchHandshake('req-off', 'res-off')
        const responses: unknown[] = []
        window.addEventListener('res-off', e => responses.push(e))

        dispatchRequest('req-off', 'id-1')
        await vi.waitFor(() => expect(responses.length).toBe(1))

        expect(sendMessage).not.toHaveBeenCalled()
        expect((responses[0] as CustomEvent).detail.response).toEqual({
            decline: true,
        })

        vi.unstubAllGlobals()
    })

    it('toggle absent from storage (default OFF): declines without forwarding', async () => {
        const { sendMessage } = stubChrome({}) // no persisted entry at all
        await import('../webauthn-relay')

        dispatchHandshake('req-default', 'res-default')
        const responses: unknown[] = []
        window.addEventListener('res-default', e => responses.push(e))

        dispatchRequest('req-default', 'id-1')
        await vi.waitFor(() => expect(responses.length).toBe(1))

        expect(sendMessage).not.toHaveBeenCalled()
        expect((responses[0] as CustomEvent).detail.response).toEqual({
            decline: true,
        })

        vi.unstubAllGlobals()
    })

    it('toggle ON: forwards the ceremony to the service worker and relays its credential response back', async () => {
        const credential = {
            id: 'cred',
            rawId: 'cred',
            type: 'public-key',
            response: {},
        }
        const { sendMessage } = stubChrome({
            storageRaw:
                '{"state":{"preferences":{"webauthnInterceptionEnabled":true}}}',
            sendMessage: (_message, callback) => callback({ credential }),
        })
        await import('../webauthn-relay')

        dispatchHandshake('req-on', 'res-on')
        const responses: unknown[] = []
        window.addEventListener('res-on', e => responses.push(e))

        dispatchRequest('req-on', 'id-1')
        await vi.waitFor(() => expect(responses.length).toBe(1))

        expect(sendMessage).toHaveBeenCalledTimes(1)
        expect((sendMessage.mock.calls[0][0] as { scope: string }).scope).toBe(
            'pera-webauthn-relay',
        )
        expect((responses[0] as CustomEvent).detail.response).toEqual({
            credential,
        })

        vi.unstubAllGlobals()
    })

    it('toggle ON, SW declines: relays the decline back verbatim', async () => {
        stubChrome({
            storageRaw:
                '{"state":{"preferences":{"webauthnInterceptionEnabled":true}}}',
            sendMessage: (_message, callback) => callback({ decline: true }),
        })
        await import('../webauthn-relay')

        dispatchHandshake('req-decl', 'res-decl')
        const responses: unknown[] = []
        window.addEventListener('res-decl', e => responses.push(e))

        dispatchRequest('req-decl', 'id-1')
        await vi.waitFor(() => expect(responses.length).toBe(1))

        expect((responses[0] as CustomEvent).detail.response).toEqual({
            decline: true,
        })

        vi.unstubAllGlobals()
    })

    it('SW-absent (torn-down mid-call): dispatches nothing, leaving MAIN to time out', async () => {
        const { sendMessage } = stubChrome({
            storageRaw:
                '{"state":{"preferences":{"webauthnInterceptionEnabled":true}}}',
        })
        // Override to simulate Chrome's real teardown-mid-call behavior.
        sendMessage.mockImplementation((_message, callback) => {
            callback(undefined)
        })
        vi.stubGlobal('chrome', {
            storage: {
                local: {
                    get: vi.fn(async () => ({
                        [SETTINGS_STORE_KV_KEY]:
                            '{"state":{"preferences":{"webauthnInterceptionEnabled":true}}}',
                    })),
                },
            },
            runtime: {
                sendMessage,
                lastError: { message: 'The message port closed' },
            },
        } as unknown as typeof chrome)

        await import('../webauthn-relay')

        dispatchHandshake('req-dead', 'res-dead')
        const responses: unknown[] = []
        window.addEventListener('res-dead', e => responses.push(e))

        dispatchRequest('req-dead', 'id-1')
        await new Promise(r => setTimeout(r, 10))

        expect(sendMessage).toHaveBeenCalledTimes(1)
        expect(responses.length).toBe(0)

        vi.unstubAllGlobals()
    })

    it('accepts only the first handshake and ignores a later (forged) one', async () => {
        const { sendMessage } = stubChrome({
            storageRaw:
                '{"state":{"preferences":{"webauthnInterceptionEnabled":true}}}',
        })
        await import('../webauthn-relay')

        dispatchHandshake('req1', 'res1')
        dispatchRequest('req1', 'id-1')
        await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))

        // A page script forging the handshake event must be ignored.
        dispatchHandshake('req2', 'res2')
        sendMessage.mockClear()
        dispatchRequest('req2', 'id-2')
        await new Promise(r => setTimeout(r, 10))
        expect(sendMessage).not.toHaveBeenCalled()

        vi.unstubAllGlobals()
    })
})
