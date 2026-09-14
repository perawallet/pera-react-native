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

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import {
    CONNECTIONS_CONTROL_SCOPE,
    WC_PAGE_PAIR_SCOPE,
} from '@perawallet/wallet-extension-platform-chrome'
import { installConnectModalPairRoute } from '../connect-modal-pair'

const URI = 'wc:topic@1?bridge=https%3A%2F%2Fb.example&key=00'

const makeChromeMock = () => {
    const listeners: ((
        message: unknown,
        sender: unknown,
        sendResponse: (r: unknown) => void,
    ) => boolean | void)[] = []
    return {
        listeners,
        runtime: {
            id: 'ext-id',
            getURL: (path: string) => `chrome-extension://ext-id/${path}`,
            onMessage: {
                addListener: vi.fn(listener => listeners.push(listener)),
            },
            sendMessage: vi.fn().mockResolvedValue(undefined),
        },
        deliver: (message: unknown, sender: unknown) =>
            listeners[0]?.(message, sender, () => {}),
    }
}

describe('installConnectModalPairRoute', () => {
    let chromeMock: ReturnType<typeof makeChromeMock>
    let ensureOffscreenDocumentLike: Mock<() => Promise<void>>

    beforeEach(() => {
        chromeMock = makeChromeMock()
        ensureOffscreenDocumentLike = vi
            .fn<() => Promise<void>>()
            .mockResolvedValue(undefined)
        installConnectModalPairRoute({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            chromeLike: chromeMock as any,
            ensureOffscreenDocumentLike,
        })
    })

    it('forwards a pair control message stamped with the verified origin, ensuring the offscreen document first', async () => {
        const result = chromeMock.deliver(
            { scope: WC_PAGE_PAIR_SCOPE, uri: URI },
            { origin: 'https://dapp.example', tab: { id: 7 } },
        )

        // onMessage is shared with other listeners: a stray `true` here would
        // make chrome wait on this listener for a response that never comes.
        expect(result).toBe(false)

        await vi.waitFor(() => {
            expect(chromeMock.runtime.sendMessage).toHaveBeenCalled()
        })

        expect(ensureOffscreenDocumentLike).toHaveBeenCalled()
        // Exact shape, so page-controlled keys can never ride onto the control message.
        expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
            scope: CONNECTIONS_CONTROL_SCOPE,
            kind: 'pair',
            uri: URI,
            requesterOrigin: 'https://dapp.example',
        })
    })

    it('does not forward until the offscreen document is ensured', async () => {
        let resolveEnsure: () => void = () => {}
        ensureOffscreenDocumentLike.mockReturnValue(
            new Promise<void>(resolve => {
                resolveEnsure = resolve
            }),
        )

        chromeMock.deliver(
            { scope: WC_PAGE_PAIR_SCOPE, uri: URI },
            { origin: 'https://dapp.example', tab: { id: 7 } },
        )

        expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled()

        resolveEnsure()
        await vi.waitFor(() => {
            expect(chromeMock.runtime.sendMessage).toHaveBeenCalled()
        })
    })

    it('does not produce an unhandled rejection when ensure/forward fails on a cold service worker', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const boom = new Error('Could not establish connection')
        ensureOffscreenDocumentLike.mockRejectedValueOnce(boom)

        expect(() =>
            chromeMock.deliver(
                { scope: WC_PAGE_PAIR_SCOPE, uri: URI },
                { origin: 'https://dapp.example', tab: { id: 7 } },
            ),
        ).not.toThrow()

        await vi.waitFor(() => {
            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('connect-modal pair'),
                boom,
            )
        })
        expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled()
        errorSpy.mockRestore()
    })

    it('ignores a page-supplied requesterOrigin and uses sender.origin', async () => {
        chromeMock.deliver(
            {
                scope: WC_PAGE_PAIR_SCOPE,
                uri: URI,
                requesterOrigin: 'https://trusted.example',
            },
            { origin: 'https://attacker.example', tab: { id: 7 } },
        )

        await vi.waitFor(() => {
            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    requesterOrigin: 'https://attacker.example',
                }),
            )
        })
    })

    it('rejects a sender with no origin', () => {
        chromeMock.deliver({ scope: WC_PAGE_PAIR_SCOPE, uri: URI }, {})
        expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled()
        expect(ensureOffscreenDocumentLike).not.toHaveBeenCalled()
    })

    it('rejects the opaque "null" origin', () => {
        chromeMock.deliver(
            { scope: WC_PAGE_PAIR_SCOPE, uri: URI },
            { origin: 'null' },
        )
        expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled()
        expect(ensureOffscreenDocumentLike).not.toHaveBeenCalled()
    })

    it('rejects a non-http(s) origin', () => {
        chromeMock.deliver(
            { scope: WC_PAGE_PAIR_SCOPE, uri: URI },
            { origin: 'file://' },
        )
        expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled()
        expect(ensureOffscreenDocumentLike).not.toHaveBeenCalled()
    })

    it('rejects a malformed pair message', () => {
        chromeMock.deliver(
            { scope: WC_PAGE_PAIR_SCOPE, uri: 'https://evil.example' },
            { origin: 'https://dapp.example' },
        )
        expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled()
        expect(ensureOffscreenDocumentLike).not.toHaveBeenCalled()
    })

    it('returns false for a message on another scope so other listeners see it', () => {
        const result = chromeMock.listeners[0]?.(
            { scope: 'pera-db-control', kind: 'ensure-offscreen' },
            { origin: 'https://dapp.example' },
            () => {},
        )
        expect(result).toBe(false)
        expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled()
    })

    it('rejects attacker-controlled extra properties on the page message', async () => {
        chromeMock.deliver(
            {
                scope: WC_PAGE_PAIR_SCOPE,
                uri: URI,
                maliciousExtra: 'evil',
                anotherExtra: 42,
            },
            { origin: 'https://dapp.example', tab: { id: 7 } },
        )

        await vi.waitFor(() => {
            expect(chromeMock.runtime.sendMessage).toHaveBeenCalled()
        })

        const [sent] = chromeMock.runtime.sendMessage.mock.calls[0] as [
            Record<string, unknown>,
        ]
        expect(Object.keys(sent).sort()).toEqual(
            ['kind', 'requesterOrigin', 'scope', 'uri'].sort(),
        )
    })
})
