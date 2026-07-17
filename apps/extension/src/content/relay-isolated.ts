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

import { DAPP_RELAY_SCOPE } from '@perawallet/wallet-extension-platform-chrome'
import {
    CHANNEL_HANDSHAKE_EVENT,
    CHANNEL_RELAY_READY_EVENT,
    type BridgeRequestEnvelope,
    type BridgeResponseEnvelope,
} from './channel'

// Isolated-world relay. Learns the MAIN script's per-load channel names from the
// handshake, then round-trips each request to the SW over chrome.runtime and
// dispatches the response back on the response channel.
let requestEventName: string | null = null
let responseEventName: string | null = null

const onRequest = (e: Event): void => {
    const { id, request } = (e as CustomEvent).detail as BridgeRequestEnvelope
    chrome.runtime.sendMessage(
        { scope: DAPP_RELAY_SCOPE, request },
        (response: unknown) => {
            // The SW can be killed between receiving this request and
            // responding (event page teardown mid-call). When that happens,
            // Chrome invokes this callback with `lastError` set and
            // `response === undefined` instead of ever delivering a real
            // envelope. Dispatching `{ id, response: undefined }` in that
            // case would resolve (and clear) MAIN's pending entry with a
            // bogus "success", so the dapp gets an undefined result and the
            // 120s MethodTimedOutError backstop in inject-main.ts never
            // fires. Read (and discard) lastError to prevent an "unchecked
            // runtime.lastError" console warning, then bail out without
            // dispatching — MAIN's own timeout is what delivers the
            // terminal error to the page in this case.
            const lastError = chrome.runtime.lastError
            if (lastError || response === undefined) return
            if (!responseEventName) return
            window.dispatchEvent(
                new CustomEvent(responseEventName, {
                    detail: { id, response } satisfies BridgeResponseEnvelope,
                }),
            )
        },
    )
}

window.addEventListener(CHANNEL_HANDSHAKE_EVENT, (e: Event) => {
    // Accept only the first handshake. Both content scripts run at
    // document_start before any page script, so the legitimate MAIN-script
    // handshake always arrives first; a later handshake can only be a page
    // script forging the fixed, page-discoverable CHANNEL_HANDSHAKE_EVENT
    // name to hijack the channels. Ignore it outright: no rebind, no second
    // request listener.
    if (requestEventName) return

    const detail = (e as CustomEvent).detail as {
        requestEventName: string
        responseEventName: string
    }
    requestEventName = detail.requestEventName
    responseEventName = detail.responseEventName
    window.addEventListener(requestEventName, onRequest)
})

// Announce readiness AFTER the handshake listener above is registered, so if
// MAIN's handshake dispatch already happened (and was dropped because no
// listener existed yet), MAIN can react to this event by re-dispatching it.
// A page script forging CHANNEL_RELAY_READY_EVENT gains nothing: it only
// causes MAIN to re-dispatch its own already-fixed, per-load channel names —
// it cannot inject different ones, and the first-only guard above still
// prevents any handshake (forged or real) from rebinding after the first.
// Those channel names ARE observable by same-world page scripts (inject-main.ts
// runs in the MAIN world, same JS realm as the page), but that's not a trust
// boundary: authorization is enforced at the SW by checking `sender.origin`,
// not by keeping the channel names secret.
window.dispatchEvent(new CustomEvent(CHANNEL_RELAY_READY_EVENT))
