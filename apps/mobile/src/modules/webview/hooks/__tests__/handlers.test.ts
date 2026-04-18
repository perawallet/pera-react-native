/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    isTrustedWebviewOrigin,
    JsonRpcErrorCode,
    requireSecure,
    sendNotificationToWebview,
} from '../handlers'

const mockLogger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() }
vi.mock('@perawallet/wallet-core-shared', () => ({
    get logger() {
        return mockLogger
    },
    AppError: class AppError extends Error {},
}))

vi.mock('react-native-webview', () => ({ default: {} }))

describe('sendNotificationToWebview', () => {
    const mockInjectJavaScript = vi.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockWebview = { injectJavaScript: mockInjectJavaScript } as any

    it('injects a JSON-RPC notification without an id field', () => {
        sendNotificationToWebview(
            'onHostContextChanged',
            { contexts: ['settings'] },
            mockWebview,
        )

        expect(mockInjectJavaScript).toHaveBeenCalledTimes(1)
        const injected = mockInjectJavaScript.mock.calls[0][0] as string
        const parsed = JSON.parse(
            injected.replace(/^window\.postMessage\(/, '').replace(/\);$/, ''),
        )

        expect(parsed).toEqual({
            jsonrpc: '2.0',
            method: 'onHostContextChanged',
            params: { contexts: ['settings'] },
        })
        expect(parsed).not.toHaveProperty('id')
    })

    it('passes the method and params through correctly', () => {
        sendNotificationToWebview(
            'someEvent',
            { foo: 'bar', count: 42 },
            mockWebview,
        )

        const injected = mockInjectJavaScript.mock.calls[0][0] as string
        const parsed = JSON.parse(
            injected.replace(/^window\.postMessage\(/, '').replace(/\);$/, ''),
        )

        expect(parsed.method).toBe('someEvent')
        expect(parsed.params).toEqual({ foo: 'bar', count: 42 })
    })

    it('does not throw when webview is null', () => {
        expect(() =>
            sendNotificationToWebview(
                'onHostContextChanged',
                { contexts: [] },
                null,
            ),
        ).not.toThrow()
    })
})

describe('requireSecure', () => {
    const mockInjectJavaScript = vi.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockWebview = { injectJavaScript: mockInjectJavaScript } as any

    beforeEach(() => {
        mockInjectJavaScript.mockClear()
        mockLogger.warn.mockClear()
    })

    const context = {
        operation: 'getSettings',
        messageId: 'msg-1',
        sourceUrl: 'https://evil.com/',
        webview: mockWebview,
    }

    it('invokes handler when securedConnection is true', () => {
        const handler = vi.fn()

        requireSecure(true, context, handler)

        expect(handler).toHaveBeenCalledTimes(1)
        expect(mockInjectJavaScript).not.toHaveBeenCalled()
        expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    it('blocks and sends Unauthorized error when securedConnection is false', () => {
        const handler = vi.fn()

        requireSecure(false, context, handler)

        expect(handler).not.toHaveBeenCalled()
        expect(mockInjectJavaScript).toHaveBeenCalledTimes(1)
        const injected = mockInjectJavaScript.mock.calls[0][0] as string
        const parsed = JSON.parse(
            injected.replace(/^window\.postMessage\(/, '').replace(/\);$/, ''),
        )
        expect(parsed).toEqual({
            id: 'msg-1',
            jsonrpc: '2.0',
            error: {
                code: JsonRpcErrorCode.Unauthorized,
                message: 'Operation not permitted from this origin',
            },
        })
    })

    it('logs the blocked request with operation and source URL', () => {
        requireSecure(false, context, vi.fn())

        expect(mockLogger.warn).toHaveBeenCalledTimes(1)
        expect(mockLogger.warn).toHaveBeenCalledWith(
            'Blocked WebView bridge call from untrusted origin',
            {
                operation: 'getSettings',
                sourceUrl: 'https://evil.com/',
                messageId: 'msg-1',
            },
        )
    })
})

describe('isTrustedWebviewOrigin', () => {
    const trusted = [
        'https://onramp-mobile-staging.perawallet.app/',
        'https://discover-mobile-staging.perawallet.app/',
        'https://staking-mobile-staging.perawallet.app/',
    ]

    it('accepts an exact origin match with a deep path and query', () => {
        expect(
            isTrustedWebviewOrigin(
                'https://discover-mobile-staging.perawallet.app/deep/path?q=1',
                trusted,
            ),
        ).toBe(true)
    })

    it('rejects a prefix-attack subdomain', () => {
        expect(
            isTrustedWebviewOrigin(
                'https://discover-mobile-staging.perawallet.app.evil.com/',
                trusted,
            ),
        ).toBe(false)
    })

    it('rejects a scheme downgrade', () => {
        expect(
            isTrustedWebviewOrigin(
                'http://discover-mobile-staging.perawallet.app/',
                trusted,
            ),
        ).toBe(false)
    })

    it('rejects a port mismatch', () => {
        expect(
            isTrustedWebviewOrigin(
                'https://discover-mobile-staging.perawallet.app:8080/',
                trusted,
            ),
        ).toBe(false)
    })

    it('returns false for a malformed URL without throwing', () => {
        expect(isTrustedWebviewOrigin('not a url', trusted)).toBe(false)
    })

    it('returns false for an empty trusted list', () => {
        expect(
            isTrustedWebviewOrigin(
                'https://discover-mobile-staging.perawallet.app/',
                [],
            ),
        ).toBe(false)
    })
})
