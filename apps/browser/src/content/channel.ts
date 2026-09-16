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

// Private page↔isolated bridge for window.pera. Event names are randomized per
// document load so page code cannot forge relay traffic or responses. The MAIN
// script generates them and hands them to the relay via a one-shot handshake
// CustomEvent.
export const CHANNEL_HANDSHAKE_EVENT = '__pera_bridge_handshake__'

// Dispatched by the isolated relay once its handshake listener is registered,
// so whichever content script loads first (MAIN or isolated — manifest order
// is not guaranteed to survive refactors) can trigger a re-dispatch of the
// handshake instead of relying on a single synchronous CustomEvent that is
// silently dropped when no listener is attached yet.
export const CHANNEL_RELAY_READY_EVENT = '__pera_bridge_relay_ready__'

// Request-direction detail: MAIN world -> isolated relay.
export type BridgeRequestEnvelope<TRequest = unknown> = {
    id: string
    request: TRequest
}

// Response-direction detail: isolated relay -> MAIN world.
//
// On the window.pera channel this id is deliberately the JSON-RPC id, not a
// separate channel-local one: whichever side answers (the relay echoing the
// id it was handed for an inline refusal, or the wallet's own response) the
// page settles on the JSON-RPC id, so a second numbering would only be a way
// for the two to disagree. The WebAuthn pair reuses this type with a genuinely
// channel-local id, because its payload carries none.
export type BridgeResponseEnvelope<TResponse = unknown> = {
    id: string
    response: TResponse
}

// Wallet-initiated push (accountsChanged, networkChanged, disconnect): no
// channel id because nothing on the page is waiting for it.
export type BridgeNotificationEnvelope<TNotification = unknown> = {
    notification: TNotification
}

// Same per-load-randomized-channel scheme as the window.pera pair above, reused
// for the WebAuthn interception pair (webauthn-main.ts / webauthn-relay.ts).
// A separate handshake/ready event pair (not the window.pera constants above) so
// the two unrelated content-script pairs — both matching every http/https
// page — never cross-wire even though they share this file's generic
// BridgeRequestEnvelope/BridgeResponseEnvelope shapes.
export const WEBAUTHN_CHANNEL_HANDSHAKE_EVENT = '__pera_webauthn_handshake__'
export const WEBAUTHN_CHANNEL_RELAY_READY_EVENT =
    '__pera_webauthn_relay_ready__'

// One-way MAIN -> isolated signal for a connect-modal pair request. Separate
// from the window.pera and WebAuthn channels above so the three all-URLs script
// pairs never cross-wire. No handshake and no per-load randomization: unlike
// the window.pera channel there is no response to forge, and the SW validates
// `sender.origin` on arrival regardless of who dispatched the event.
//
// This event name is fixed and page-discoverable by design, so ANY page
// script can dispatch it directly — reaching the pair path with no modal, no
// injected row, and no click at all. Pairing is inert until the user selects
// accounts and approves in the wallet: that approval is the actual enforced
// boundary here, and the click on the injected row is a UX affordance that
// makes provenance legible to the user, not a security control this event's
// fixed name provides.
export const CONNECT_MODAL_PAIR_EVENT = '__pera_connect_modal_pair__'

export type ConnectModalPairDetail = { uri: string }
