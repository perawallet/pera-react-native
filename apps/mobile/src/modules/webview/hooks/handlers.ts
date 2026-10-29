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

import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import type WebView from 'react-native-webview'

export * from './handlers-shared'
import {
    createRequireSecure,
    sanitizeErrorForWebview,
    type JsonRpcErrorCode,
} from './handlers-shared'
import { webViewScript } from '../utils/webViewScript'

export const sendMessageToWebview = (
    id: string,
    payload: unknown,
    webview: Nullable<WebView>,
) => {
    const response = { id, jsonrpc: '2.0', result: payload }
    logger.debug('Sending webview interface response', { response, webview })
    webview?.injectJavaScript(webViewScript`window.postMessage(${response});`)
}

export const sendNotificationToWebview = (
    method: string,
    params: unknown,
    webview: Nullable<WebView>,
) => {
    const notification = { jsonrpc: '2.0', method, params }
    logger.debug('Sending webview notification', { notification })
    webview?.injectJavaScript(
        webViewScript`window.postMessage(${notification});`,
    )
}

/**
 * Sends an `{ action, payload }` message to the webview's `message` listener.
 * Unlike {@link sendMessageToWebview} (which posts a JSON-RPC *object*), the
 * Discover web app's favorite listener runs `JSON.parse(event.data)`, so
 * `event.data` must be a JSON *string*: it is stringified here, then the
 * serializer encodes that string as a string literal in the injected call.
 */
export const sendActionToWebview = (
    action: string,
    payload: unknown,
    webview: Nullable<WebView>,
) => {
    logger.debug('Sending webview action', { action })
    webview?.injectJavaScript(
        webViewScript`window.postMessage(${JSON.stringify({ action, payload })});`,
    )
}

export const sendErrorToWebview = (
    id: string,
    code: JsonRpcErrorCode,
    error: Error | string,
    webview: Nullable<WebView>,
) => {
    const response = {
        id,
        jsonrpc: '2.0',
        error: {
            code,
            message:
                typeof error === 'string'
                    ? error
                    : sanitizeErrorForWebview(error),
        },
    }
    logger.debug('Sending webview interface error', { response, webview })
    webview?.injectJavaScript(webViewScript`window.postMessage(${response});`)
}

export const requireSecure = createRequireSecure(sendErrorToWebview)
