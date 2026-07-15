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

import {
    logger,
    AppError,
    bytesToHex,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type WebView from 'react-native-webview'

const MAX_ERROR_LENGTH = 200
const GENERIC_ERROR_MESSAGE = 'An error occurred during signing'

/**
 * Returns a message safe to send to a webview.
 * {@link AppError} subclasses carry curated messages designed for display;
 * generic Error instances may contain internal details (stack traces, paths)
 * that should not be exposed to untrusted web content.
 */
const sanitizeErrorForWebview = (error: Error): string => {
    const message =
        error instanceof AppError ? error.message : GENERIC_ERROR_MESSAGE
    return message.length > MAX_ERROR_LENGTH
        ? message.slice(0, MAX_ERROR_LENGTH)
        : message
}

export const JsonRpcErrorCode = {
    ParseError: -32_700,
    InvalidRequest: -32_600,
    MethodNotFound: -32_601,
    InvalidParams: -32_602,
    InternalError: -32_603,
    ServerErrorStart: -32_000,
    Unauthorized: -32_001,
    ServerErrorEnd: -32_099,
} as const

export type JsonRpcErrorCode =
    (typeof JsonRpcErrorCode)[keyof typeof JsonRpcErrorCode]

export type RequireSecureContext = {
    operation: string
    messageId: string
    sourceUrl: string | null
    webview: WebView | null
}

export const requireSecure = (
    securedConnection: boolean,
    context: RequireSecureContext,
    handler: () => void,
) => {
    if (!securedConnection) {
        logger.warn('Blocked WebView bridge call from untrusted origin', {
            operation: context.operation,
            sourceUrl: context.sourceUrl,
            messageId: context.messageId,
        })
        sendErrorToWebview(
            context.messageId,
            JsonRpcErrorCode.Unauthorized,
            'Operation not permitted from this origin',
            context.webview,
        )
        return
    }
    handler()
}

export const isTrustedWebviewOrigin = (
    url: string,
    trusted: string[],
): boolean => {
    const candidate = safeOrigin(url)
    if (!candidate) return false
    return trusted.some(base => {
        const baseOrigin = safeOrigin(base)
        return baseOrigin !== null && baseOrigin === candidate
    })
}

/**
 * Per-load secret stamped onto every bridge message by the main-frame-only
 * injected script. `injectedJavaScript` runs only in the main frame, but
 * `window.ReactNativeWebView.postMessage` is reachable from every subframe —
 * so a cross-origin iframe or injected subresource could otherwise post a
 * forged JSON-RPC message straight to the bridge. The token defeats that: a
 * cross-origin frame can't read the main frame's token, so it can't stamp a
 * message the native side will accept.
 */
export const generateBridgeToken = (): string => {
    const bytes = new Uint8Array(16)
    const webCrypto = (globalThis as { crypto?: Crypto }).crypto
    if (webCrypto?.getRandomValues) {
        webCrypto.getRandomValues(bytes)
    } else {
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = Math.floor(Math.random() * 256)
        }
    }
    return bytesToHex(bytes)
}

/**
 * True only if every message in the payload carries the expected bridge
 * token. Messages without it came from a subframe (or were forged) and must
 * be dropped. An empty/non-object payload is never valid.
 */
export const hasValidBridgeToken = (data: unknown, token: string): boolean => {
    if (!token) return false
    const items = Array.isArray(data) ? data : [data]
    if (items.length === 0) return false
    return items.every(
        item =>
            typeof item === 'object' &&
            item !== null &&
            (item as { token?: unknown }).token === token,
    )
}

export const isSafeBrowserUrl = (url: string): boolean => {
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        return false
    }
    return parsed.protocol === 'https:'
}

const RELATIVE_PATH_BASE = 'https://perawallet.invalid/'

export const isSafeRelativePath = (path: string): boolean => {
    if (!path) return false
    try {
        const resolved = new URL(path, RELATIVE_PATH_BASE)
        return resolved.origin === new URL(RELATIVE_PATH_BASE).origin
    } catch {
        return false
    }
}

const safeOrigin = (url: string): string | null => {
    try {
        const origin = new URL(url).origin
        return origin === 'null' ? null : origin
    } catch {
        return null
    }
}

export const sendMessageToWebview = (
    id: string,
    payload: unknown,
    webview: Nullable<WebView>,
) => {
    const message = `window.postMessage(${JSON.stringify({
        id,
        jsonrpc: '2.0',
        result: payload,
    })});`
    logger.debug('Sending webview interface response', { message, webview })
    webview?.injectJavaScript(message)
}

export const sendNotificationToWebview = (
    method: string,
    params: unknown,
    webview: Nullable<WebView>,
) => {
    const message = `window.postMessage(${JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
    })});`
    logger.debug('Sending webview notification', { message })
    webview?.injectJavaScript(message)
}

/**
 * Action sent to the Discover web app to toggle the current page's favorite
 * state. The web app owns favorites persistence (localStorage); the native
 * side only mirrors the state for the star icon and asks the web app to toggle.
 */
export const BROWSER_FAVORITE_ACTION = 'handleBrowserFavoriteButtonClick'

/**
 * Action carrying the wallet's device id back to the Discover web app. The web
 * app requests it (via `peraMobileInterface.getDeviceId`) to load the user's
 * favorites, which are server-side state keyed by device id — so favorites
 * survive an in-place upgrade as long as the migrated device id is handed over.
 * Mirrors Android's `PeraMobileWebInterface.getDeviceId` → `getSendDeviceId`.
 */
export const GET_DEVICE_ID_ACTION = 'getDeviceId'

/**
 * Sends an `{ action, payload }` message to the webview's `message` listener.
 * Unlike {@link sendMessageToWebview} (which posts a JSON-RPC *object*), the
 * Discover web app's favorite listener runs `JSON.parse(event.data)`, so
 * `event.data` must be a JSON *string* — hence the double stringify (once for
 * the data, once to embed it as a string literal in the injected call).
 */
export const sendActionToWebview = (
    action: string,
    payload: unknown,
    webview: Nullable<WebView>,
) => {
    const data = JSON.stringify({ action, payload })
    const message = `window.postMessage(${JSON.stringify(data)});`
    logger.debug('Sending webview action', { action })
    webview?.injectJavaScript(message)
}

export const sendErrorToWebview = (
    id: string,
    code: JsonRpcErrorCode,
    error: Error | string,
    webview: Nullable<WebView>,
) => {
    const message = `window.postMessage(${JSON.stringify({
        id,
        jsonrpc: '2.0',
        error: {
            code,
            message:
                typeof error === 'string'
                    ? error
                    : sanitizeErrorForWebview(error),
        },
    })});`
    logger.debug('Sending webview interface error', { message, webview })
    webview?.injectJavaScript(message)
}
