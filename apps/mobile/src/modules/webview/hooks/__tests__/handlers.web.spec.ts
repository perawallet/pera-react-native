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
import {
    asBridgeWebview,
    sendActionToWebview,
    sendErrorToWebview,
    sendMessageToWebview,
    sendNotificationToWebview,
    requireSecure,
    JsonRpcErrorCode,
    type WebviewBridgeTransport,
} from '../handlers.web'

const makeTransport = (): WebviewBridgeTransport & {
    posts: unknown[]
} => {
    const posts: unknown[] = []
    return { posts, postToWebview: (data: unknown) => posts.push(data) }
}

describe('handlers.web senders', () => {
    it('posts a native-shaped JSON-RPC result object', () => {
        const transport = makeTransport()
        sendMessageToWebview('42', { ok: true }, asBridgeWebview(transport))
        expect(transport.posts).toEqual([
            { id: '42', jsonrpc: '2.0', result: { ok: true } },
        ])
    })

    it('posts a native-shaped JSON-RPC error object with a sanitized message', () => {
        const transport = makeTransport()
        sendErrorToWebview(
            '7',
            JsonRpcErrorCode.InvalidParams,
            new Error('boom'),
            asBridgeWebview(transport),
        )
        const [posted] = transport.posts as [
            {
                id: string
                jsonrpc: string
                error: { code: number; message: string }
            },
        ]
        expect(posted.id).toBe('7')
        expect(posted.error.code).toBe(JsonRpcErrorCode.InvalidParams)
        expect(typeof posted.error.message).toBe('string')
    })

    it('posts a notification with no id', () => {
        const transport = makeTransport()
        sendNotificationToWebview(
            'onHostContextChanged',
            { contexts: ['settings'] },
            asBridgeWebview(transport),
        )
        expect(transport.posts).toEqual([
            {
                jsonrpc: '2.0',
                method: 'onHostContextChanged',
                params: { contexts: ['settings'] },
            },
        ])
    })

    it('posts actions as a JSON STRING (Discover JSON.parses event.data)', () => {
        const transport = makeTransport()
        sendActionToWebview(
            'handleBrowserFavoriteButtonClick',
            { name: 'App', url: 'https://a.b', logo: null },
            asBridgeWebview(transport),
        )
        const [posted] = transport.posts
        expect(typeof posted).toBe('string')
        expect(JSON.parse(posted as string)).toEqual({
            action: 'handleBrowserFavoriteButtonClick',
            payload: { name: 'App', url: 'https://a.b', logo: null },
        })
    })

    it('drops sends when webview is null instead of throwing', () => {
        expect(() => sendMessageToWebview('1', {}, null)).not.toThrow()
    })

    it('requireSecure blocks untrusted origins with an Unauthorized error', () => {
        const transport = makeTransport()
        const handler = vi.fn()
        requireSecure(
            false,
            {
                operation: 'getAddresses',
                messageId: '9',
                sourceUrl: 'https://evil.example',
                webview: asBridgeWebview(transport),
            },
            handler,
        )
        expect(handler).not.toHaveBeenCalled()
        const [posted] = transport.posts as [{ error: { code: number } }]
        expect(posted.error.code).toBe(JsonRpcErrorCode.Unauthorized)
    })
})
