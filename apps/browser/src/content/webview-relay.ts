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

// Shared ISOLATED-world relay body for every MAIN/ISOLATED bridge pair
// (Discover, Bidali). Page -> host goes over a handshaken CustomEvent channel
// (first handshake wins, same anti-forgery rule as relay-isolated.ts); host ->
// page uses window.postMessage, since the two worlds share DOM events and the
// page's existing listeners then see native-shaped envelopes unchanged. Inert
// without the extension-stamped token param.
//
// The Port name is namespaced per-token, so pairs sharing this body can't
// collide; their handshake events can't cross either, since the pairs are
// declared on disjoint origins in manifest.json.
import type { DiscoverChannelHandshake } from '@perawallet/wallet-core-browser-runtime'
import {
    WEBVIEW_BRIDGE_PORT_PREFIX,
    WEBVIEW_BRIDGE_TOKEN_PARAM,
    WEBVIEW_BRIDGE_HANDSHAKE_EVENT,
    WEBVIEW_BRIDGE_RELAY_READY_EVENT,
} from '@perawallet/wallet-core-browser-runtime'

// Both worlds have read their params once the MAIN half's handshake lands, so
// they come off the address bar: page scripts, analytics and same-origin
// Referer headers would otherwise keep seeing the bridge token for the life of
// the document. A reload then comes up without the token, so the host's
// port-death recovery remounts the frame with a fresh one.
const scrubUrlParams = (names: readonly string[]): void => {
    const url = new URL(window.location.href)
    const present = names.filter(name => url.searchParams.has(name))
    if (present.length === 0) return
    present.forEach(name => url.searchParams.delete(name))
    window.history.replaceState(window.history.state, '', url.toString())
}

/**
 * `extraUrlParams` names the pair's own URL-borne params (Bidali's balances)
 * to scrub alongside the bridge token once the handshake lands.
 */
export const runWebviewRelay = (
    extraUrlParams: readonly string[] = [],
): void => {
    const token = new URLSearchParams(window.location.search).get(
        WEBVIEW_BRIDGE_TOKEN_PARAM,
    )

    if (token) {
        const port = chrome.runtime.connect({
            name: `${WEBVIEW_BRIDGE_PORT_PREFIX}${token}`,
        })
        let channel: DiscoverChannelHandshake | null = null

        port.onMessage.addListener((data: unknown) => {
            // Objects (JSON-RPC results/errors/notifications) and strings
            // (double-stringified actions) both pass through verbatim.
            window.postMessage(data, window.location.origin)
        })

        window.addEventListener(WEBVIEW_BRIDGE_HANDSHAKE_EVENT, event => {
            if (channel) return // first handshake wins
            const detail = (event as CustomEvent<DiscoverChannelHandshake>)
                .detail
            if (!detail?.requestEventName) return
            channel = detail
            scrubUrlParams([WEBVIEW_BRIDGE_TOKEN_PARAM, ...extraUrlParams])
            window.addEventListener(channel.requestEventName, requestEvent => {
                port.postMessage((requestEvent as CustomEvent).detail)
            })
        })

        // If the MAIN-world script loaded first, its handshake already
        // fired — ask again.
        window.dispatchEvent(new CustomEvent(WEBVIEW_BRIDGE_RELAY_READY_EVENT))
    }
}
