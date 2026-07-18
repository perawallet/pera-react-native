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

// Shared ISOLATED-world relay body for every MAIN/ISOLATED content-script
// bridge pair (Discover iframe today, Bidali in Task 3): owns the
// chrome.runtime Port to the hosting extension page and relays both ways.
// Page → host: CustomEvent channel handshaken with the pair's MAIN-world
// script (first handshake wins, same anti-forgery rule as
// relay-isolated.ts). Host → page: window.postMessage on the shared window —
// ISOLATED and MAIN worlds share DOM events, so the page's existing
// listeners receive native-shaped envelopes unchanged. Inert without the
// extension-stamped token param.
//
// The DISCOVER_BRIDGE_*/DISCOVER_HANDSHAKE_EVENT/DISCOVER_RELAY_READY_EVENT
// constants are named for the Discover pair but are reused here
// deliberately, not accidentally: the Port name is namespaced per-token
// (`${DISCOVER_BRIDGE_PORT_PREFIX}${token}`), so two callers sharing the
// prefix can't collide as long as tokens are unique, and the Discover and
// Bidali script pairs are declared on disjoint origins in manifest.json
// (`*.perawallet.app` vs `*.bidali.com`), so their handshake/ready events —
// scoped to a single document via window CustomEvents — never cross paths
// either. Renaming these constants to a neutral name is a larger,
// out-of-scope refactor; the sharing is safe as-is.
import type { DiscoverChannelHandshake } from '@perawallet/wallet-extension-platform-chrome'
import {
    DISCOVER_BRIDGE_PORT_PREFIX,
    DISCOVER_BRIDGE_TOKEN_PARAM,
    DISCOVER_HANDSHAKE_EVENT,
    DISCOVER_RELAY_READY_EVENT,
} from '@perawallet/wallet-extension-platform-chrome'

export const runWebviewRelay = (): void => {
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
            const detail = (event as CustomEvent<DiscoverChannelHandshake>)
                .detail
            if (!detail?.requestEventName) return
            channel = detail
            window.addEventListener(channel.requestEventName, requestEvent => {
                port.postMessage((requestEvent as CustomEvent).detail)
            })
        })

        // If the MAIN-world script loaded first, its handshake already
        // fired — ask again.
        window.dispatchEvent(new CustomEvent(DISCOVER_RELAY_READY_EVENT))
    }
}
