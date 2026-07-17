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

// ISOLATED-world half of the Discover iframe bridge: owns the chrome.runtime
// Port to the hosting extension page (PWWebView.web) and relays both ways.
// Page → host: CustomEvent channel handshaken with discover-main.ts (first
// handshake wins, same anti-forgery rule as relay-isolated.ts). Host → page:
// window.postMessage on the shared window — ISOLATED and MAIN worlds share
// DOM events, so the page's existing listeners receive native-shaped
// envelopes unchanged. Inert without the extension-stamped token param.
import type { DiscoverChannelHandshake } from '@perawallet/wallet-extension-platform-chrome'
import {
    DISCOVER_BRIDGE_PORT_PREFIX,
    DISCOVER_BRIDGE_TOKEN_PARAM,
    DISCOVER_HANDSHAKE_EVENT,
    DISCOVER_RELAY_READY_EVENT,
} from '@perawallet/wallet-extension-platform-chrome'

const token = new URLSearchParams(window.location.search).get(
    DISCOVER_BRIDGE_TOKEN_PARAM,
)

if (token) {
    const port = chrome.runtime.connect({
        name: `${DISCOVER_BRIDGE_PORT_PREFIX}${token}`,
    })
    let channel: DiscoverChannelHandshake | null = null

    port.onMessage.addListener((data: unknown) => {
        // Objects (JSON-RPC results/errors/notifications) and strings
        // (double-stringified actions) both pass through verbatim.
        window.postMessage(data, window.location.origin)
    })

    window.addEventListener(DISCOVER_HANDSHAKE_EVENT, event => {
        if (channel) return // first handshake wins
        const detail = (event as CustomEvent<DiscoverChannelHandshake>).detail
        if (!detail?.requestEventName) return
        channel = detail
        window.addEventListener(channel.requestEventName, requestEvent => {
            port.postMessage((requestEvent as CustomEvent).detail)
        })
    })

    // If discover-main loaded first, its handshake already fired — ask again.
    window.dispatchEvent(new CustomEvent(DISCOVER_RELAY_READY_EVENT))
}

export {}
