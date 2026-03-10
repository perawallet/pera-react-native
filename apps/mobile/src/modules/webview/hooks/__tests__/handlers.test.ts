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

import { describe, it, expect, vi } from 'vitest'
import { sendNotificationToWebview } from '../handlers'

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { debug: vi.fn() },
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
