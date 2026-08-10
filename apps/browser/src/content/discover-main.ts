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
import {
    CONNECT_MODAL_WRAPPER_ID,
    extractUriFromConnectModal,
    isWcUri,
} from './connect-modal-uri'
import { connectWebviewMainChannel } from './webview-main-channel'

const mainChannel = connectWebviewMainChannel('disc')

if (mainChannel) {
    const { token, relay } = mainChannel

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
        // Unlike the other rpcCall(...) entries, this one can't blindly
        // forward the page's params: canOpenURL's real gate (OS-registered
        // scheme handlers) is a no-op on react-native-web, so this content
        // script is the only scheme check left standing on the web platform.
        // Mirrors bidaliProvider.openUrl's string/{url} normalization.
        openSystemBrowser: (params: unknown = {}) => {
            const url =
                typeof params === 'object' && params !== null
                    ? (params as Record<string, unknown>).url
                    : params
            if (typeof url !== 'string') return
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                return
            }
            sendRNMessage('openSystemBrowser', { url })
        },
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
    // Drop the same URI if it's already been sent within this window.
    const DEDUP_WINDOW_MS = 2000
    let lastUri = ''
    let lastUriAt = 0

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

    const processModals = (): void => {
        // Redirect modal: its launch link has no wc URI (it just opens
        // 'perawallet-wc://?browser=...'), and the SDK fires that
        // window.open on insert anyway. Suppress it; the window.open hook
        // below catches the URI-bearing deep link from the connect path.
        const redirect = document.getElementById(
            'pera-wallet-redirect-modal-wrapper',
        )
        if (redirect) redirect.remove()

        const connect = document.getElementById(CONNECT_MODAL_WRAPPER_ID)
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

    // Same coalescing rationale as connect-modal-watcher: this observer is
    // subtree-wide for the document's lifetime, and one scheduled run per
    // mutation burst is equivalent to one per mutation.
    let scheduled = false
    const scheduleProcessModals = (): void => {
        if (scheduled) return
        scheduled = true
        queueMicrotask(() => {
            scheduled = false
            processModals()
        })
    }

    const attachObserver = (): void => {
        try {
            const observer = new MutationObserver(scheduleProcessModals)
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
