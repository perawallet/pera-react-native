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

import { Linking } from 'react-native'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { dappRelayableErrorNames } from '@perawallet/wallet-core-connections/dappRequest'
import {
    JsonRpcErrorCode,
    sanitizeErrorForWebview as sanitizeDappError,
} from '@perawallet/wallet-core-dapp/wire'
import { logger, bytesToHex } from '@perawallet/wallet-core-shared'
import type WebView from 'react-native-webview'

import { toLoadableUrl } from '../components/PWWebView/toLoadableUrl'

// One codec for the in-app webview and the extension's window.pera bridge.
// The `/wire` subpath, not the barrel: the barrel reaches the handler and its
// connections graph, which nothing in the webview bridge needs.
export { JsonRpcErrorCode } from '@perawallet/wallet-core-dapp/wire'

// The in-app bridge speaks ARC-0001, which only the legacy networks' chain
// does, so it relays that chain's adapter errors on top of the codec default.
export const sanitizeErrorForWebview = (error: Error): string =>
    sanitizeDappError(error, dappRelayableErrorNames(LEGACY_CHAIN_ID))

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
 * Blocks bridge ops from an untrusted main-frame origin with a JSON-RPC
 * Unauthorized. Platform files bind their own `sendErrorToWebview`.
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
 * Per-load secret stamped on every bridge message. `injectedJavaScript` runs
 * only in the main frame, but `postMessage` is reachable from every subframe —
 * so without this a cross-origin iframe could forge a JSON-RPC message. It
 * can't read the main frame's token, so it can't stamp an acceptable one.
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

/** A message without the token came from a subframe, or was forged. */
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

const SCHEME_PATTERN = /^([a-z][a-z\d+.-]*):/i

// Script/document-carrying schemes, and the ones that address the browser or
// the extension itself, which a page must never reach through the wallet.
const BLOCKED_NATIVE_URI_SCHEMES = new Set([
    'javascript',
    'data',
    'blob',
    'file',
    'about',
    'chrome',
    'chrome-extension',
    'moz-extension',
])

/**
 * Gates a dApp-supplied URI for the OS (custom schemes are the point here, so
 * no https-only rule). It must carry an explicit scheme: react-native-web
 * resolves a scheme-less string against the current `chrome-extension://` page.
 */
export const toValidatedNativeUri = (raw: unknown): string | null => {
    if (typeof raw !== 'string') return null
    const trimmed = raw.trim()
    const scheme = SCHEME_PATTERN.exec(trimmed)?.[1]?.toLowerCase()
    if (!scheme || BLOCKED_NATIVE_URI_SCHEMES.has(scheme)) return null
    return trimmed
}

/**
 * The only way a peer-, backend- or metadata-supplied URL may reach
 * `Linking.openURL`: react-native-web resolves a relative string against the
 * current page, which in the extension is a `chrome-extension://` surface.
 * Returns false (and opens nothing) when {@link toValidatedBrowserUrl} rejects it.
 */
export const openValidatedBrowserUrl = (raw: unknown): boolean => {
    const url = toValidatedBrowserUrl(raw)
    if (!url) {
        logger.warn('Refused to open unvalidated external URL', { url: raw })
        return false
    }
    // No OS handler for the URL is a device condition, not our bug.
    // oxlint-disable-next-line pera/no-unvalidated-open-url -- validated just above
    Linking.openURL(url).catch(err =>
        logger.warn('Failed to open external URL', { url, err }),
    )
    return true
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
