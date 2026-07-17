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

    // WC-URI interception (spec: window.open hook only for M6; the
    // MutationObserver half of native peraConnectJS — modal scraping/dedup —
    // is deferred to M7 pairing work).
    const originalOpen = window.open.bind(window)
    window.open = (...args: Parameters<typeof window.open>) => {
        const target =
            typeof args[0] === 'string' ? args[0] : args[0]?.toString()
        if (target?.startsWith('wc:')) {
            sendRNMessage('walletConnect', { uri: target })
            return null
        }
        return originalOpen(...args)
    }
}

export {}
