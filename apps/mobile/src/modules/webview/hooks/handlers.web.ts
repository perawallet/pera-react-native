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

// Web twins of the native bridge senders: the native versions build JS strings
// and run them via webview.injectJavaScript — impossible against a cross-origin
// iframe. Here the "webview" is a WebviewBridgeTransport (a chrome.runtime
// Port wrapper supplied by PWWebView.web.tsx) posting structured envelopes;
// the ISOLATED content script re-posts them into the page via
// window.postMessage, so the page-visible shapes match native exactly
// (see handlers.ts sendMessageToWebview/sendActionToWebview).
import type WebView from 'react-native-webview'

import {
    createRequireSecure,
    sanitizeErrorForWebview,
    type JsonRpcErrorCode,
} from './handlers-shared'

export * from './handlers-shared'

export type WebviewBridgeTransport = { postToWebview: (data: unknown) => void }

/** The transport doubles as the `webview` argument of usePeraWebviewInterface. */
export const asBridgeWebview = (transport: WebviewBridgeTransport): WebView =>
    transport as unknown as WebView

/** Typed inverse of `asBridgeWebview` — recovers the transport a bridge
 * webview object was built from (e.g. to send from a caller that only holds
 * a `WebView | null` ref, like native's webviewRef). Null-safe. */
export const asBridgeTransport = (
    webview: WebView | null,
): WebviewBridgeTransport | null =>
    (webview as unknown as WebviewBridgeTransport | null) ?? null

const transportOf = asBridgeTransport

export const sendMessageToWebview = (
    messageId: string,
    payload: unknown,
    webview: WebView | null,
): void => {
    transportOf(webview)?.postToWebview({
        id: messageId,
        jsonrpc: '2.0',
        result: payload,
    })
}

export const sendNotificationToWebview = (
    method: string,
    params: unknown,
    webview: WebView | null,
): void => {
    transportOf(webview)?.postToWebview({ jsonrpc: '2.0', method, params })
}

// Native double-stringifies actions (the Discover listener JSON.parses
// event.data) — preserve the string shape.
export const sendActionToWebview = (
    action: string,
    payload: unknown,
    webview: WebView | null,
): void => {
    transportOf(webview)?.postToWebview(JSON.stringify({ action, payload }))
}

export const sendErrorToWebview = (
    messageId: string,
    code: JsonRpcErrorCode,
    error: Error | string,
    webview: WebView | null,
): void => {
    transportOf(webview)?.postToWebview({
        id: messageId,
        jsonrpc: '2.0',
        error: {
            code,
            message:
                typeof error === 'string'
                    ? error
                    : sanitizeErrorForWebview(error),
        },
    })
}

export const requireSecure = createRequireSecure(sendErrorToWebview)
