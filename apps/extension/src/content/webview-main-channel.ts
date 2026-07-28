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

// Shared MAIN-world handshake preamble for every MAIN/ISOLATED content-script
// bridge pair (Discover iframe, Bidali): reads the bridge token off the URL,
// builds a per-load DiscoverChannelHandshake, and dispatches/re-dispatches it
// until the ISOLATED relay (webview-relay.ts) picks it up. Callers differ
// only in the RPC surface they install afterward (window.peraMobileInterface
// vs window.bidaliProvider) — that surface-specific logic stays in each call
// site's own file.
import type { DiscoverChannelHandshake } from '@perawallet/wallet-extension-platform-chrome'
import {
    WEBVIEW_BRIDGE_TOKEN_PARAM,
    WEBVIEW_BRIDGE_HANDSHAKE_EVENT,
    WEBVIEW_BRIDGE_RELAY_READY_EVENT,
} from '@perawallet/wallet-extension-platform-chrome'

export type WebviewMainChannel = {
    token: string
    relay: (message: Record<string, unknown>) => void
}

/**
 * Reads the bridge token from `window.location.search`; returns `null` if
 * absent (mirrors each call site's existing `if (token) { ... }` inert
 * gating). When present, builds a handshake using `eventPrefix` in place of
 * the pair-specific substring (`disc`/`bidali`), dispatches it, re-dispatches
 * on the ISOLATED relay's ready event, and returns the token plus a `relay()`
 * helper that dispatches a CustomEvent under the handshake's
 * requestEventName.
 */
export const connectWebviewMainChannel = (
    eventPrefix: string,
): WebviewMainChannel | null => {
    const token = new URLSearchParams(window.location.search).get(
        WEBVIEW_BRIDGE_TOKEN_PARAM,
    )

    if (!token) return null

    const rand = (): string => crypto.randomUUID().replace(/-/g, '')
    const channel: DiscoverChannelHandshake = {
        requestEventName: `__pera_${eventPrefix}_req_${rand()}__`,
        responseEventName: `__pera_${eventPrefix}_res_${rand()}__`,
    }

    const dispatchHandshake = (): void => {
        window.dispatchEvent(
            new CustomEvent(WEBVIEW_BRIDGE_HANDSHAKE_EVENT, {
                detail: channel,
            }),
        )
    }
    // Re-dispatch if the ISOLATED relay loads after us (same recovery the
    // ARC-0027 pair uses in inject-main.ts/relay-isolated.ts).
    window.addEventListener(WEBVIEW_BRIDGE_RELAY_READY_EVENT, dispatchHandshake)
    dispatchHandshake()

    const relay = (message: Record<string, unknown>): void => {
        window.dispatchEvent(
            new CustomEvent(channel.requestEventName, { detail: message }),
        )
    }

    return { token, relay }
}
