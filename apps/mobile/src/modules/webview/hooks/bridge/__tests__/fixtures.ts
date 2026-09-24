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

import { vi, type Mock } from 'vitest'
import type WebView from 'react-native-webview'
import type { WebviewMessageSecurity } from '../../handlers'
import type { WebviewMessage } from '../types'

export type MockWebview = WebView & { injectJavaScript: Mock }

export const createMockWebview = (): MockWebview =>
    ({ injectJavaScript: vi.fn() }) as unknown as MockWebview

export const bridgeMessage = (
    id: string,
    method: string,
    params: Record<string, unknown> = {},
): WebviewMessage => ({ id, jsonrpc: '2.0', method, params })

export const TRUSTED: WebviewMessageSecurity = {
    securedConnection: true,
    sourceUrl: 'https://discover-mobile.perawallet.app/',
}

/** Everything injected into the webview so far, as one searchable string. */
export const injectedScript = (webview: MockWebview): string =>
    webview.injectJavaScript.mock.calls.map(call => String(call[0])).join('')

/** The `event.data` object of the last `{ action, payload }` message sent. */
export const lastAction = (webview: MockWebview): unknown => {
    const injected = String(webview.injectJavaScript.mock.calls.at(-1)?.[0])
    const eventData = JSON.parse(
        injected.replace(/^window\.postMessage\(/, '').replace(/\);$/, ''),
    )
    return JSON.parse(eventData)
}

export const languageMockValue = (currentLanguage?: string) => ({
    t: (key: string, params?: Record<string, string>) => {
        if (key === 'errors.webview.unsupported_url' && params?.url) {
            return `Unsupported URL: ${params.url}`
        }
        return key
    },
    currentLanguage,
    changeLanguage: vi.fn(),
})
