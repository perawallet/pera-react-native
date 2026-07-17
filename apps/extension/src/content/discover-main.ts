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

// MAIN-world bridge for the Discover iframe. Native injects this same surface
// via react-native-webview injectedJavaScript (injected-scripts.ts's
// peraMobileInterfaceJS); on web a content script is the only way to install
// page-visible globals. Inert without the extension-stamped URL token: this
// script also matches regular *.perawallet.app tabs (all_frames, no iframe),
// where no bridge host exists on the other side.
import type { DiscoverChannelHandshake } from '@perawallet/wallet-extension-platform-chrome'
import {
    DISCOVER_BRIDGE_TOKEN_PARAM,
    DISCOVER_HANDSHAKE_EVENT,
    DISCOVER_RELAY_READY_EVENT,
} from '@perawallet/wallet-extension-platform-chrome'

const token = new URLSearchParams(window.location.search).get(
    DISCOVER_BRIDGE_TOKEN_PARAM,
)

if (token) {
    const rand = (): string => crypto.randomUUID().replace(/-/g, '')
    const channel: DiscoverChannelHandshake = {
        requestEventName: `__pera_disc_req_${rand()}__`,
        responseEventName: `__pera_disc_res_${rand()}__`,
    }

    const dispatchHandshake = (): void => {
        window.dispatchEvent(
            new CustomEvent(DISCOVER_HANDSHAKE_EVENT, { detail: channel }),
        )
    }
    // Re-dispatch if the ISOLATED relay loads after us (same recovery the
    // ARC-0027 pair uses in inject-main.ts/relay-isolated.ts).
    window.addEventListener(DISCOVER_RELAY_READY_EVENT, dispatchHandshake)
    dispatchHandshake()

    const relay = (message: Record<string, unknown>): void => {
        window.dispatchEvent(
            new CustomEvent(channel.requestEventName, { detail: message }),
        )
    }

    // Mirrors native's __stampToken (injected-scripts.ts): stamps every
    // element of a JSON-RPC batch, or the single request object.
    const stampToken = (request: string): Record<string, unknown> => {
        let parsed: Record<string, unknown> | Record<string, unknown>[]
        try {
            parsed = JSON.parse(request) as
                | Record<string, unknown>
                | Record<string, unknown>[]
        } catch {
            parsed = {}
        }
        if (Array.isArray(parsed)) {
            parsed.forEach(item => {
                if (item && typeof item === 'object') item.token = token
            })
            return parsed as unknown as Record<string, unknown>
        }
        parsed.token = token
        return parsed
    }

    const sendJsonRPCMessage = (request: string): void => {
        relay(stampToken(request))
    }

    const sendRNMessage = (action: string, params: unknown = {}): void => {
        relay({
            jsonrpc: '2.0',
            method: action,
            params,
            id: Date.now(),
            token,
        })
    }

    const rpcCall =
        (method: string) =>
        (params: unknown = {}): void =>
            sendRNMessage(method, params)

    window.peraRPC = { sendJsonRPCMessage, sendRNMessage }
    window.peraMobileInterface = {
        version: '2',
        handleRequest: (request: string) => sendJsonRPCMessage(request),
        pushWebView: rpcCall('pushWebView'),
        openSystemBrowser: rpcCall('openSystemBrowser'),
        canOpenURI: rpcCall('canOpenURI'),
        openNativeURI: rpcCall('openNativeURI'),
        notifyUser: rpcCall('notifyUser'),
        getAddresses: rpcCall('getAddresses'),
        getDeviceId: rpcCall('getDeviceId'),
        getSettings: rpcCall('getSettings'),
        getPublicSettings: rpcCall('getPublicSettings'),
        onBackPressed: rpcCall('onBackPressed'),
        logAnalyticsEvent: rpcCall('logAnalyticsEvent'),
        closeWebView: rpcCall('closeWebView'),
        // V1 alias, exactly as injected-scripts.ts defines it: params is a
        // JSON string, forwarded parsed (not re-wrapped) as pushWebView's params.
        pushDappViewerScreen: (params: string) =>
            sendRNMessage('pushWebView', JSON.parse(params)),
        getAuthorizedAddresses: rpcCall('getAddresses'),
    }

    // WC-URI hook, ported from native peraConnectJS (injected-scripts.ts) —
    // constants, isWcUri/sendUri semantics, and the modal-scraping fallback
    // chain are copied exactly so a dapp using @perawallet/connect pairs the
    // same way in the Discover iframe as it does in the native webview.
    const WC_SCHEME = 'wc'
    const PERAWALLET_WC_SCHEME = 'perawallet-wc'
    // Cap forwarded URI length (real WC URIs are well under this; longer
    // inputs are either malformed or a hostile page trying to overload the
    // RPC bridge).
    const MAX_URI_LENGTH = 4096
    // Drop the same URI if it's already been sent within this window.
    const DEDUP_WINDOW_MS = 2000
    let lastUri = ''
    let lastUriAt = 0

    const isWcUri = (value: unknown): value is string =>
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= MAX_URI_LENGTH &&
        (value.startsWith(`${WC_SCHEME}:`) ||
            value.startsWith(`${PERAWALLET_WC_SCHEME}:`))

    const sendUri = (uri: unknown): boolean => {
        if (!isWcUri(uri)) return false
        const now = Date.now()
        if (uri === lastUri && now - lastUriAt < DEDUP_WINDOW_MS) return true
        lastUri = uri
        lastUriAt = now
        try {
            sendRNMessage('walletConnect', { uri })
        } catch {
            // Mirrors native's swallow-and-continue: a bridge failure here
            // must not break the dapp's own window.open call site.
        }
        return true
    }

    const extractUriFromConnectModal = (
        wrapper: Element | null,
    ): string | null => {
        if (!wrapper) return null
        // Current (@perawallet/connect >=1.3): the wc URI is set as the
        // 'uri' attribute on the <pera-wallet-connect-modal> custom element
        // itself (with '&algorand=true' appended).
        const modal = wrapper.querySelector('pera-wallet-connect-modal')
        if (modal) {
            const attr = modal.getAttribute('uri')
            if (isWcUri(attr)) return attr
            // Legacy: a launch button nested inside touch-screen-mode shadow DOM.
            try {
                const touch = modal.shadowRoot?.querySelector(
                    'pera-wallet-modal-touch-screen-mode',
                )
                const btn = touch?.shadowRoot?.querySelector(
                    '#pera-wallet-connect-modal-touch-screen-mode-launch-pera-wallet-button',
                )
                const href = btn?.getAttribute('href')
                if (isWcUri(href)) return href
            } catch {
                // DOM probing across shadow roots — tolerate absence/shape drift.
            }
        }
        // Legacy: class-based fallback (pre-shadow-DOM versions).
        const legacy = wrapper.getElementsByClassName(
            'pera-wallet-connect-modal-touch-screen-mode__launch-pera-wallet-button',
        )[0]
        const legacyHref = legacy?.getAttribute('href')
        if (isWcUri(legacyHref)) return legacyHref
        return null
    }

    const processModals = (): void => {
        // Redirect modal: its launch link has no wc URI (it just opens
        // 'perawallet-wc://?browser=...'), and the SDK fires that
        // window.open on insert anyway. Suppress it; the window.open hook
        // below catches the URI-bearing deep link from the connect path.
        const redirect = document.getElementById(
            'pera-wallet-redirect-modal-wrapper',
        )
        if (redirect) redirect.remove()

        const connect = document.getElementById(
            'pera-wallet-connect-modal-wrapper',
        )
        if (connect) {
            const uri = extractUriFromConnectModal(connect)
            if (sendUri(uri)) {
                connect.remove()
            }
        }
    }

    // Hook window.open: when @perawallet/connect detects it's running
    // inside a webview it skips the modal entirely and calls window.open
    // with the wc/perawallet-wc URI directly — the primary path inside
    // Pera's webview.
    try {
        const originalOpen = window.open.bind(window)
        window.open = (...args: Parameters<typeof window.open>) => {
            const target = args[0]
            if (isWcUri(target) && sendUri(target)) {
                return null
            }
            return originalOpen(...args)
        }
    } catch {
        // window.open is non-configurable in some hosts — fall back to no hook.
    }

    const attachObserver = (): void => {
        try {
            const observer = new MutationObserver(processModals)
            observer.observe(document.body, {
                childList: true,
                subtree: true,
            })
        } catch {
            // document.body absent/inaccessible — nothing to observe.
        }
        // Also run once in case the modal was inserted before the observer attached.
        processModals()
    }

    // document.body may not exist yet at document_start; mirror native's
    // "run once after attaching" by deferring to DOMContentLoaded when so.
    if (document.body) {
        attachObserver()
    } else {
        window.addEventListener('DOMContentLoaded', attachObserver, {
            once: true,
        })
    }
}

export {}
