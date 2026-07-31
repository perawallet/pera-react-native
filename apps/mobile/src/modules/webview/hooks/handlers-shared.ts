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

import { logger, AppError, bytesToHex } from '@perawallet/wallet-core-shared'
import type WebView from 'react-native-webview'

import { toLoadableUrl } from '../components/PWWebView/toLoadableUrl'

const MAX_ERROR_LENGTH = 200
const GENERIC_ERROR_MESSAGE = 'An error occurred during signing'

/**
 * Returns a message safe to send to a webview.
 * {@link AppError} subclasses carry curated messages designed for display;
 * generic Error instances may contain internal details (stack traces, paths)
 * that should not be exposed to untrusted web content.
 */
export const sanitizeErrorForWebview = (error: Error): string => {
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

/**
 * Trust decision for a single bridge message: whether the originating frame
 * is the trusted webview origin, and the URL that decision was made against.
 */
export type WebviewMessageSecurity = {
    securedConnection: boolean
    sourceUrl: string | null
}

type SendError = (
    messageId: string,
    code: JsonRpcErrorCode,
    error: Error | string,
    webview: WebView | null,
) => void

/**
 * Builds the platform requireSecure gate: blocks bridge ops arriving from an
 * untrusted main-frame origin, replying with a JSON-RPC Unauthorized error.
 * The platform files bind their own sendErrorToWebview (injectJavaScript on
 * native, port transport on web).
 */
export const createRequireSecure =
    (sendError: SendError) =>
    (
        securedConnection: boolean,
        context: RequireSecureContext,
        handler: () => void,
    ): void => {
        if (!securedConnection) {
            logger.warn('Blocked WebView bridge call from untrusted origin', {
                operation: context.operation,
                sourceUrl: context.sourceUrl,
                messageId: context.messageId,
            })
            sendError(
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
    if (!webCrypto?.getRandomValues) {
        // Fail closed: a Math.random fallback would make the anti-forgery
        // token predictable. quick-crypto's install() populates this at app
        // entry (shim.js), so throwing here can only mean a broken runtime.
        throw new Error(
            'crypto.getRandomValues is unavailable — cannot create a bridge token',
        )
    }
    webCrypto.getRandomValues(bytes)
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

/**
 * Normalizes a host-app-supplied browser URL (bare domains like
 * `perawallet.app` get an https:// prefix, per {@link toLoadableUrl}) before
 * the https-only gate. Returns the normalized URL, or null when the input is
 * not a string, is empty, is scheme-relative (`//host` — nothing legitimate
 * produces it, so it stays rejected), or fails {@link isSafeBrowserUrl} after
 * normalization (http:, javascript:, data:, file:, blob:, unparseable).
 * Non-strings must be rejected before normalization: `https://` + a coerced
 * number parses as an IPv4 host and would slip through the gate.
 */
export const toValidatedBrowserUrl = (raw: unknown): string | null => {
    if (typeof raw !== 'string') return null
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('//')) return null
    const normalized = toLoadableUrl(trimmed)
    return isSafeBrowserUrl(normalized) ? normalized : null
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

export const safeOrigin = (url: string): string | null => {
    try {
        const origin = new URL(url).origin
        return origin === 'null' ? null : origin
    } catch {
        return null
    }
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
