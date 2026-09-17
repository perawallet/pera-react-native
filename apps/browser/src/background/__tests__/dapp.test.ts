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

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import {
    DAPP_HOST_REQUEST_SCOPE,
    DAPP_HOST_RESPONSE_SCOPE,
    DAPP_PAGE_REQUEST_SCOPE,
    DAPP_PAGE_RESPONSE_SCOPE,
} from '@perawallet/wallet-extension-platform-chrome'
import { JsonRpcErrorCode } from '@perawallet/wallet-core-dapp/wire'
import {
    installDappHostResponseRoute,
    installDappPageRequestRoute,
} from '../dapp'

type Listener = (
    message: unknown,
    sender: unknown,
    sendResponse: (r: unknown) => void,
) => boolean | void

const makeChromeMock = () => {
    const listeners: Listener[] = []
    const tabsSendMessage = vi.fn().mockResolvedValue(undefined)
    const tabsQuery = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }, {}])
    const runtimeSendMessage = vi.fn().mockResolvedValue({ ok: true })
    return {
        listeners,
        tabsSendMessage,
        tabsQuery,
        runtimeSendMessage,
        runtime: {
            id: 'ext-id',
            getURL: (path: string) => `chrome-extension://ext-id/${path}`,
            onMessage: { addListener: (l: Listener) => listeners.push(l) },
            sendMessage: runtimeSendMessage,
        },
        tabs: { sendMessage: tabsSendMessage, query: tabsQuery },
        deliver: (message: unknown, sender: unknown) =>
            new Promise<unknown>(resolve => {
                let sync = true
                for (const listener of listeners) {
                    const handled = listener(message, sender, response =>
                        resolve(response),
                    )
                    if (handled === true) sync = false
                    if (handled !== false) break
                }
                if (sync) resolve(undefined)
            }),
    }
}

const request = { jsonrpc: '2.0' as const, id: 'r1', method: 'connect' }
const pageMessage = {
    scope: DAPP_PAGE_REQUEST_SCOPE,
    request,
    hasUserActivation: true,
}
const contentSender = {
    id: 'ext-id',
    origin: 'https://a.example',
    url: 'https://a.example/app',
    tab: { id: 7, favIconUrl: 'https://a.example/f.ico' },
}
const swSender = {
    id: 'ext-id',
    url: 'chrome-extension://ext-id/offscreen.html',
}

describe('installDappPageRequestRoute', () => {
    let chromeMock: ReturnType<typeof makeChromeMock>
    let ensureOffscreenDocumentLike: Mock<() => Promise<void>>
    beforeEach(() => {
        chromeMock = makeChromeMock()
        ensureOffscreenDocumentLike = vi
            .fn<() => Promise<void>>()
            .mockResolvedValue(undefined)
        installDappPageRequestRoute({
            chromeLike: chromeMock as never,
            ensureOffscreenDocumentLike,
        })
    })

    it('acks an accepted request, then forwards it to the host stamped with sender origin, tab and favicon', async () => {
        const ack = await chromeMock.deliver(pageMessage, contentSender)
        expect(ack).toEqual({ ok: true })
        await vi.waitFor(() =>
            expect(chromeMock.runtimeSendMessage).toHaveBeenCalled(),
        )
        expect(ensureOffscreenDocumentLike).toHaveBeenCalled()
        expect(chromeMock.runtimeSendMessage).toHaveBeenCalledWith({
            scope: DAPP_HOST_REQUEST_SCOPE,
            origin: 'https://a.example',
            hasUserActivation: true,
            faviconUrl: 'https://a.example/f.ico',
            returnTo: { tabId: 7 },
            request,
        })
    })

    it('refuses an insecure origin with an Unauthorized response in the ack and forwards nothing', async () => {
        const ack = (await chromeMock.deliver(pageMessage, {
            ...contentSender,
            origin: 'http://a.example',
        })) as { ok: boolean; response: { error: { code: number } } }
        expect(ack.ok).toBe(false)
        expect(ack.response.error.code).toBe(JsonRpcErrorCode.Unauthorized)
        expect(chromeMock.runtimeSendMessage).not.toHaveBeenCalled()
    })

    it("refuses a sender that is not this extension's content script", async () => {
        const ack = (await chromeMock.deliver(pageMessage, {
            ...contentSender,
            id: 'other-ext',
        })) as { ok: boolean }
        expect(ack.ok).toBe(false)
        expect(chromeMock.runtimeSendMessage).not.toHaveBeenCalled()
    })

    it('refuses an oversized payload with InvalidParams before anything is forwarded', async () => {
        const big = {
            ...pageMessage,
            request: {
                ...request,
                method: 'requestTransactionSigning',
                params: { txns: [{ txn: 'A'.repeat(70_000) }] },
            },
        }
        const ack = (await chromeMock.deliver(big, contentSender)) as {
            ok: boolean
            response: { error: { code: number } }
        }
        expect(ack.ok).toBe(false)
        expect(ack.response.error.code).toBe(JsonRpcErrorCode.InvalidParams)
        expect(chromeMock.runtimeSendMessage).not.toHaveBeenCalled()
    })

    it('answers the tab with InternalError when the host never takes the request', async () => {
        chromeMock.runtimeSendMessage.mockRejectedValue(new Error('no host'))
        vi.useFakeTimers()
        await chromeMock.deliver(pageMessage, contentSender)
        await vi.advanceTimersByTimeAsync(10_000)
        vi.useRealTimers()
        expect(chromeMock.tabsSendMessage).toHaveBeenCalledWith(7, {
            scope: DAPP_PAGE_RESPONSE_SCOPE,
            origin: 'https://a.example',
            payload: expect.objectContaining({
                id: 'r1',
                error: expect.objectContaining({
                    code: JsonRpcErrorCode.InternalError,
                }),
            }),
        })
    })

    it('ignores unrelated messages', async () => {
        expect(
            await chromeMock.deliver({ scope: 'other' }, contentSender),
        ).toBeUndefined()
    })
})

describe('installDappHostResponseRoute', () => {
    let chromeMock: ReturnType<typeof makeChromeMock>
    beforeEach(() => {
        chromeMock = makeChromeMock()
        installDappHostResponseRoute({ chromeLike: chromeMock as never })
    })
    const payload = { jsonrpc: '2.0' as const, id: 'r1', result: null }

    it('delivers an addressed response to that tab and acks', async () => {
        const ack = await chromeMock.deliver(
            {
                scope: DAPP_HOST_RESPONSE_SCOPE,
                origin: 'https://a.example',
                payload,
                returnTo: { tabId: 7 },
            },
            swSender,
        )
        expect(ack).toEqual({ ok: true })
        expect(chromeMock.tabsSendMessage).toHaveBeenCalledWith(7, {
            scope: DAPP_PAGE_RESPONSE_SCOPE,
            origin: 'https://a.example',
            payload,
        })
    })

    it('reports a closed tab as not delivered', async () => {
        chromeMock.tabsSendMessage.mockRejectedValueOnce(
            new Error('No tab with id'),
        )
        const ack = await chromeMock.deliver(
            {
                scope: DAPP_HOST_RESPONSE_SCOPE,
                origin: 'https://a.example',
                payload,
                returnTo: { tabId: 7 },
            },
            swSender,
        )
        expect(ack).toEqual({ ok: false })
    })

    it('broadcasts a notification to every tab with an id, tolerating tabs without our content script', async () => {
        chromeMock.tabsSendMessage.mockRejectedValueOnce(
            new Error('no receiver'),
        )
        const notification = {
            jsonrpc: '2.0' as const,
            method: 'disconnect',
            params: {},
        }
        const ack = await chromeMock.deliver(
            {
                scope: DAPP_HOST_RESPONSE_SCOPE,
                origin: 'https://a.example',
                payload: notification,
            },
            swSender,
        )
        expect(ack).toEqual({ ok: true })
        expect(chromeMock.tabsSendMessage).toHaveBeenCalledTimes(2)
    })

    it('ignores a host response from a content-script sender', async () => {
        expect(
            await chromeMock.deliver(
                {
                    scope: DAPP_HOST_RESPONSE_SCOPE,
                    origin: 'https://a.example',
                    payload,
                    returnTo: { tabId: 7 },
                },
                contentSender,
            ),
        ).toBeUndefined()
        expect(chromeMock.tabsSendMessage).not.toHaveBeenCalled()
    })
})
