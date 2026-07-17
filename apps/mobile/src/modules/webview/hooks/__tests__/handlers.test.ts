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

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    BROWSER_FAVORITE_ACTION,
    generateBridgeToken,
    hasValidBridgeToken,
    isSafeBrowserUrl,
    isSafeRelativePath,
    isTrustedWebviewOrigin,
    JsonRpcErrorCode,
    requireSecure,
    sendActionToWebview,
    sendNotificationToWebview,
} from '../handlers'

const mockLogger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() }
vi.mock('@perawallet/wallet-core-shared', () => ({
    get logger() {
        return mockLogger
    },
    AppError: class AppError extends Error {},
    bytesToHex: (bytes: Uint8Array) =>
        Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''),
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

describe('sendActionToWebview', () => {
    const mockInjectJavaScript = vi.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockWebview = { injectJavaScript: mockInjectJavaScript } as any

    beforeEach(() => {
        mockInjectJavaScript.mockClear()
    })

    it('posts event.data as a JSON string of { action, payload }', () => {
        const payload = {
            name: 'Tinyman',
            url: 'https://tinyman.org',
            logo: null,
        }

        sendActionToWebview(BROWSER_FAVORITE_ACTION, payload, mockWebview)

        const injected = mockInjectJavaScript.mock.calls[0][0] as string
        // Outer parse unwraps the string literal; the web app then JSON.parses
        // event.data, so the unwrapped value must itself be a JSON string.
        const eventData = JSON.parse(
            injected.replace(/^window\.postMessage\(/, '').replace(/\);$/, ''),
        )
        expect(typeof eventData).toBe('string')
        expect(JSON.parse(eventData)).toEqual({
            action: 'handleBrowserFavoriteButtonClick',
            payload,
        })
    })

    it('does not throw when webview is null', () => {
        expect(() =>
            sendActionToWebview(BROWSER_FAVORITE_ACTION, {}, null),
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

describe('isSafeBrowserUrl', () => {
    it('accepts any well-formed HTTPS URL', () => {
        expect(isSafeBrowserUrl('https://tinyman.org/')).toBe(true)
        expect(
            isSafeBrowserUrl('https://explorer.perawallet.app/asset/123/'),
        ).toBe(true)
        expect(isSafeBrowserUrl('https://example.com/path?q=1#hash')).toBe(true)
    })

    it('rejects HTTP URLs', () => {
        expect(isSafeBrowserUrl('http://example.com/')).toBe(false)
    })

    it('rejects javascript: URLs', () => {
        expect(isSafeBrowserUrl('javascript:alert(1)')).toBe(false)
    })

    it('rejects data: URLs', () => {
        expect(isSafeBrowserUrl('data:text/html,<script>x</script>')).toBe(
            false,
        )
    })

    it('rejects file: URLs', () => {
        expect(isSafeBrowserUrl('file:///etc/passwd')).toBe(false)
    })

    it('rejects malformed URLs without throwing', () => {
        expect(isSafeBrowserUrl('not a url')).toBe(false)
        expect(isSafeBrowserUrl('')).toBe(false)
    })
})

describe('isSafeRelativePath', () => {
    it('accepts simple relative paths', () => {
        expect(isSafeRelativePath('main/markets')).toBe(true)
        expect(isSafeRelativePath('section?filter=x')).toBe(true)
        expect(isSafeRelativePath('some/page#anchor')).toBe(true)
    })

    it('accepts absolute paths anchored at the origin root', () => {
        expect(isSafeRelativePath('/main/markets')).toBe(true)
    })

    it('rejects absolute URLs with an http(s) scheme', () => {
        expect(isSafeRelativePath('https://evil.com/phish')).toBe(false)
        expect(isSafeRelativePath('http://evil.com/')).toBe(false)
    })

    it('rejects protocol-relative URLs', () => {
        expect(isSafeRelativePath('//evil.com/phish')).toBe(false)
    })

    it('rejects javascript: and other opaque schemes', () => {
        expect(isSafeRelativePath('javascript:alert(1)')).toBe(false)
        expect(isSafeRelativePath('data:text/html,<script>x</script>')).toBe(
            false,
        )
        expect(isSafeRelativePath('file:///etc/passwd')).toBe(false)
    })

    it('rejects empty or missing paths', () => {
        expect(isSafeRelativePath('')).toBe(false)
    })
})

describe('generateBridgeToken', () => {
    it('returns a 32-char hex string', () => {
        expect(generateBridgeToken()).toMatch(/^[0-9a-f]{32}$/)
    })

    it('returns a different token on each call', () => {
        expect(generateBridgeToken()).not.toBe(generateBridgeToken())
    })

    it('throws instead of degrading when crypto.getRandomValues is unavailable', () => {
        vi.stubGlobal('crypto', undefined)
        try {
            expect(() => generateBridgeToken()).toThrow(
                'crypto.getRandomValues',
            )
        } finally {
            vi.unstubAllGlobals()
        }
    })
})

describe('hasValidBridgeToken', () => {
    const token = 'abc123'

    it('accepts a single message carrying the matching token', () => {
        expect(
            hasValidBridgeToken({ method: 'getAddresses', token }, token),
        ).toBe(true)
    })

    it('accepts a batch where every message carries the matching token', () => {
        expect(
            hasValidBridgeToken(
                [
                    { id: '1', token },
                    { id: '2', token },
                ],
                token,
            ),
        ).toBe(true)
    })

    it('rejects a message with a missing token', () => {
        expect(hasValidBridgeToken({ method: 'getAddresses' }, token)).toBe(
            false,
        )
    })

    it('rejects a message with a wrong token', () => {
        expect(hasValidBridgeToken({ token: 'forged' }, token)).toBe(false)
    })

    it('rejects a batch if any message lacks the token', () => {
        expect(
            hasValidBridgeToken([{ token }, { token: 'forged' }], token),
        ).toBe(false)
    })

    it('rejects empty arrays and non-objects', () => {
        expect(hasValidBridgeToken([], token)).toBe(false)
        expect(hasValidBridgeToken(null, token)).toBe(false)
        expect(hasValidBridgeToken('string', token)).toBe(false)
    })

    it('rejects everything when the expected token is empty', () => {
        expect(hasValidBridgeToken({ token: '' }, '')).toBe(false)
    })
})
