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

import {
    DAPP_PAGE_REQUEST_SCOPE,
    WC_PAGE_PAIR_SCOPE,
    isDappPageRequestAck,
    isDappPageResponseMessage,
} from '@perawallet/wallet-extension-platform-chrome'
import {
    CHANNEL_HANDSHAKE_EVENT,
    CHANNEL_RELAY_READY_EVENT,
    CONNECT_MODAL_PAIR_EVENT,
    type BridgeNotificationEnvelope,
    type BridgeRequestEnvelope,
    type BridgeResponseEnvelope,
    type ConnectModalPairDetail,
} from './channel'

// Isolated-world relay. Learns the MAIN script's per-load channel names from the
// handshake, then carries page requests out to the service worker and carries
// its answers and wallet-initiated notifications back in, dispatching both on
// the response channel.
let requestEventName: string | null = null
let responseEventName: string | null = null

const onRequest = (e: Event): void => {
    const { id, request } = (e as CustomEvent).detail as BridgeRequestEnvelope
    try {
        forwardRequest(id, request)
    } catch {
        // Extension context invalidated — the page outlived an extension
        // reload or update, and sendMessage then throws SYNCHRONOUSLY rather
        // than reporting via lastError. Same guard the connect-modal handler
        // below already has. Without it every dApp request after an update
        // raises an uncaught exception in the PAGE's console (attributed to
        // the site, not the wallet). Swallowed deliberately: MAIN's own
        // DAPP_PAGE_TIMEOUT_MS backstop rejects the call with -32004, exactly
        // as in the worker-died case handled inside the callback.
    }
}

const hasUserActivation = (): boolean =>
    (navigator as Navigator & { userActivation?: { isActive: boolean } })
        .userActivation?.isActive === true

const forwardRequest = (id: string, request: unknown): void => {
    chrome.runtime.sendMessage(
        // Read here, in the ISOLATED world: a page script cannot alter this
        // world's view of the window's user-activation state.
        {
            scope: DAPP_PAGE_REQUEST_SCOPE,
            request,
            hasUserActivation: hasUserActivation(),
        },
        (ack: unknown) => {
            // A SW killed mid-call invokes this with `lastError` set and no
            // ack. Read lastError (to silence the unchecked-lastError warning)
            // and bail — MAIN's own timeout delivers the terminal error.
            const lastError = chrome.runtime.lastError
            if (lastError || ack === undefined) return
            if (!responseEventName) return
            // Accepted requests are answered later on DAPP_PAGE_RESPONSE_SCOPE;
            // only a refusal carries its response in the ack.
            if (!isDappPageRequestAck(ack) || ack.ok) return
            window.dispatchEvent(
                new CustomEvent(responseEventName, {
                    detail: {
                        id,
                        response: ack.response,
                    } satisfies BridgeResponseEnvelope,
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

// Answers and notifications from the wallet. Only the service worker (an
// extension-id sender with no tab) may speak on this scope, and only for this
// document's origin — a stale tab id must never surface another site's traffic.
chrome.runtime.onMessage.addListener(
    (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (ack: unknown) => void,
    ) => {
        if (!isDappPageResponseMessage(message)) return false
        if (sender.id !== chrome.runtime.id || sender.tab !== undefined)
            return false
        if (message.origin !== window.location.origin) return false
        if (!responseEventName) return false
        const { payload } = message
        const detail: BridgeResponseEnvelope | BridgeNotificationEnvelope =
            'id' in payload
                ? { id: String(payload.id), response: payload }
                : { notification: payload }
        window.dispatchEvent(new CustomEvent(responseEventName, { detail }))
        // Receipt by the relay, not proof the page settled: without any answer
        // chrome.tabs.sendMessage rejects, the SW reports the response as
        // undelivered, and the handler never clears the request's TTL timer.
        // Synchronous, so `return false` (no channel held open) is correct.
        sendResponse({ ok: true })
        return false
    },
)

// Connect-modal pair requests are one-way: forward to the SW and drop. The SW
// validates `sender.origin` and refuses pairs without user activation, so a
// pair failure is deliberately invisible to the dapp.
window.addEventListener(CONNECT_MODAL_PAIR_EVENT, (event: Event) => {
    const detail = (event as CustomEvent<ConnectModalPairDetail>).detail
    if (typeof detail?.uri !== 'string') return
    try {
        // Callback form, same reasoning as onRequest above: the promise form
        // would leave a dead-SW rejection unhandled. lastError is read only to
        // silence Chrome's unchecked-lastError warning.
        chrome.runtime.sendMessage(
            {
                scope: WC_PAGE_PAIR_SCOPE,
                uri: detail.uri,
                // Read in this ISOLATED world, like onRequest above: a page
                // dispatching the fixed pair event cannot forge it.
                hasUserActivation: hasUserActivation(),
            },
            () => {
                void chrome.runtime.lastError
            },
        )
    } catch {
        // Extension context invalidated: sendMessage throws synchronously
        // instead of rejecting, and an uncaught throw in a window listener
        // would surface in the page's own console.
    }
})

// After the listener is registered, so a handshake MAIN already dispatched (and
// that was dropped for want of a listener) gets re-dispatched.
//
// Forging this event gains a page nothing: it only makes MAIN re-dispatch its
// own fixed per-load channel names, and the first-only guard still blocks any
// rebind. The names are observable to same-world page scripts anyway —
// authorization is enforced at the SW via `sender.origin`, not by secrecy.
window.dispatchEvent(new CustomEvent(CHANNEL_RELAY_READY_EVENT))
