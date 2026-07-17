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

// Pure wire-format constants/types shared between the extension-page bridge
// host (bridge-host.ts) and the content scripts injected into the Discover
// iframe (Tasks 3/4). MUST stay free of chrome.* usage and side effects:
// content scripts pull this in through the narrow `dapp/content-wire.ts`
// alias instead of the full package barrel, to keep their bundle small.

/** Prefix of the chrome.runtime.Port name the ISOLATED relay opens; the
 * suffix is the per-mount bridge token stamped onto the iframe URL. */
export const DISCOVER_BRIDGE_PORT_PREFIX = 'pera-discover-bridge:'

/** Query-param name the bridge token is passed under on the iframe URL. */
export const DISCOVER_BRIDGE_TOKEN_PARAM = 'peraBridgeToken'

/** window event the MAIN-world Discover script uses to announce itself to
 * the ISOLATED relay content script (same document, cross-world). */
export const DISCOVER_HANDSHAKE_EVENT = '__pera_discover_handshake__'

/** window event the ISOLATED relay uses to tell the MAIN-world script the
 * Port to the extension page is open and ready to relay messages. */
export const DISCOVER_RELAY_READY_EVENT = '__pera_discover_relay_ready__'

export type DiscoverChannelHandshake = {
    requestEventName: string
    responseEventName: string
}
