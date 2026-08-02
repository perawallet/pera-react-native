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
    DAPP_RELAY_SCOPE,
    WC_PAGE_PAIR_SCOPE,
} from '@perawallet/wallet-extension-platform-chrome'
import {
    CHANNEL_HANDSHAKE_EVENT,
    CHANNEL_RELAY_READY_EVENT,
    CONNECT_MODAL_PAIR_EVENT,
    type BridgeRequestEnvelope,
    type BridgeResponseEnvelope,
    type ConnectModalPairDetail,
} from './channel'

// Isolated-world relay. Learns the MAIN script's per-load channel names from the
// handshake, then round-trips each request to the SW over chrome.runtime and
// dispatches the response back on the response channel.
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
        // the site, not the wallet). Swallowed deliberately: MAIN's own 120s
        // MethodTimedOutError is what tells the dApp, exactly as in the
        // worker-died case handled inside the callback.
    }
}

const forwardRequest = (id: string, request: unknown): void => {
    chrome.runtime.sendMessage(
        { scope: DAPP_RELAY_SCOPE, request },
        (response: unknown) => {
            // A SW killed mid-call invokes this with `lastError` set and no
            // response. Dispatching `{ id, response: undefined }` would resolve
            // MAIN's pending entry with a bogus success, handing the dapp an
            // undefined result and preventing the timeout backstop from ever
            // firing. Read lastError (to silence the unchecked-lastError
            // warning) and bail without dispatching — MAIN's own timeout
            // delivers the terminal error.
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

// Connect-modal pair requests are one-way: forward to the SW and drop. The SW
// validates `sender.origin`, so a pair failure is deliberately invisible to
// the dapp.
window.addEventListener(CONNECT_MODAL_PAIR_EVENT, (event: Event) => {
    const detail = (event as CustomEvent<ConnectModalPairDetail>).detail
    if (typeof detail?.uri !== 'string') return
    try {
        // Callback form, same reasoning as onRequest above: the promise form
        // would leave a dead-SW rejection unhandled. lastError is read only to
        // silence Chrome's unchecked-lastError warning.
        chrome.runtime.sendMessage(
            { scope: WC_PAGE_PAIR_SCOPE, uri: detail.uri },
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
