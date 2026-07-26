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

// ISOLATED-world half of the WebAuthn interception pair (see
// webauthn-main.ts for the MAIN-world side and the fall-through contract).
// Learns the MAIN script's per-load channel names from the handshake, gates
// every ceremony on the `webauthnInterceptionEnabled` master toggle (read
// once per page load), and — only when enabled — round-trips the ceremony to
// the service worker over chrome.runtime, relaying its response back on the
// response channel. Mirrors relay-isolated.ts's anti-forgery (first-handshake-
// wins) and dead-SW (no response -> MAIN's own timeout fires) discipline.
import {
    WEBAUTHN_RELAY_SCOPE,
    type WebauthnCeremonyResponse,
} from '@perawallet/wallet-extension-platform-chrome'
import {
    WEBAUTHN_CHANNEL_HANDSHAKE_EVENT,
    WEBAUTHN_CHANNEL_RELAY_READY_EVENT,
    type BridgeRequestEnvelope,
    type BridgeResponseEnvelope,
} from './channel'
import {
    SETTINGS_STORE_KV_KEY,
    parseWebauthnInterceptionEnabled,
} from './webauthn-toggle'

const DECLINE: WebauthnCeremonyResponse = { decline: true }

// Read once per page load — later toggles in settings only take effect on
// the next navigation/reload, matching the brief ("reads the toggle once per
// page load"). Cached as a promise (not a resolved boolean) so every
// ceremony that arrives before chrome.storage answers still awaits the same
// single read instead of racing a fresh one.
const isInterceptionEnabled: Promise<boolean> = chrome.storage.local
    .get(SETTINGS_STORE_KV_KEY)
    .then(raw =>
        parseWebauthnInterceptionEnabled(
            raw[SETTINGS_STORE_KV_KEY] as string | undefined,
        ),
    )
    // A storage read failure must never crash the relay module (which would
    // orphan every future ceremony on this page) — fail closed to disabled.
    .catch(() => false)

let requestEventName: string | null = null
let responseEventName: string | null = null

const respond = (id: string, response: WebauthnCeremonyResponse): void => {
    if (!responseEventName) return
    window.dispatchEvent(
        new CustomEvent(responseEventName, {
            detail: { id, response } satisfies BridgeResponseEnvelope,
        }),
    )
}

const onRequest = async (e: Event): Promise<void> => {
    const { id, request } = (e as CustomEvent).detail as BridgeRequestEnvelope

    const enabled = await isInterceptionEnabled
    if (!enabled) {
        respond(id, DECLINE) // MAIN falls through to the native implementation
        return
    }

    chrome.runtime.sendMessage(
        { scope: WEBAUTHN_RELAY_SCOPE, request },
        (response: unknown) => {
            // Same SW-teardown-mid-call handling as relay-isolated.ts: read
            // (and discard) lastError to silence the "unchecked
            // runtime.lastError" console warning, then bail out without
            // dispatching anything — MAIN's own 120s timeout is the terminal
            // path for a request the SW never got to answer.
            const lastError = chrome.runtime.lastError
            if (lastError || response === undefined) return
            respond(id, response as WebauthnCeremonyResponse)
        },
    )
}

window.addEventListener(WEBAUTHN_CHANNEL_HANDSHAKE_EVENT, (e: Event) => {
    // Accept only the first handshake — same anti-forgery rule as
    // relay-isolated.ts: both content scripts run at document_start before
    // any page script, so the legitimate MAIN handshake always wins the race.
    if (requestEventName) return

    const detail = (e as CustomEvent).detail as {
        requestEventName: string
        responseEventName: string
    }
    requestEventName = detail.requestEventName
    responseEventName = detail.responseEventName
    // addEventListener expects a void-returning listener; wrap the async
    // handler rather than passing it directly (a bare async function here
    // would trip no-misused-promises, and more importantly its rejection
    // would otherwise become an unhandled promise rejection instead of a
    // deliberate decline).
    window.addEventListener(requestEventName, (e: Event) => {
        void onRequest(e)
    })
})

// Announce readiness AFTER the handshake listener above is registered — see
// relay-isolated.ts's identical comment for the load-order race this covers.
window.dispatchEvent(new CustomEvent(WEBAUTHN_CHANNEL_RELAY_READY_EVENT))
