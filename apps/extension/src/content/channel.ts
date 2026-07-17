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

// Private page↔isolated bridge. Event names are randomized per document load so
// page code cannot forge relay traffic or responses. The MAIN script generates
// them and hands them to the relay via a one-shot handshake CustomEvent.
export const CHANNEL_HANDSHAKE_EVENT = '__pera_arc0027_handshake__'

// Dispatched by the isolated relay once its handshake listener is registered,
// so whichever content script loads first (MAIN or isolated — manifest order
// is not guaranteed to survive refactors) can trigger a re-dispatch of the
// handshake instead of relying on a single synchronous CustomEvent that is
// silently dropped when no listener is attached yet.
export const CHANNEL_RELAY_READY_EVENT = '__pera_arc0027_relay_ready__'

// Request-direction detail: MAIN world -> isolated relay.
export type BridgeRequestEnvelope<TRequest = unknown> = {
    id: string // per-message correlation id (channel-local, not the ARC id)
    request: TRequest
}

// Response-direction detail: isolated relay -> MAIN world.
export type BridgeResponseEnvelope<TResponse = unknown> = {
    id: string // per-message correlation id (channel-local, not the ARC id)
    response: TResponse
}
