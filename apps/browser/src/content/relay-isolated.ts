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
    EIP1193_ERROR_CODE,
    JsonRpcErrorCode,
    WC_PAGE_PAIR_SCOPE,
    isDappPageRequestAck,
    isDappPageResponseMessage,
    isDappProvider,
    type DappProvider,
} from '@perawallet/wallet-core-browser-runtime'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    CHANNEL_HANDSHAKE_EVENT,
    CHANNEL_RELAY_READY_EVENT,
    CONNECT_MODAL_PAIR_EVENT,
    type ConnectModalPairDetail,
    type DappBridgeNotificationEnvelope,
    type DappBridgeRequestEnvelope,
    type DappBridgeResponseEnvelope,
} from './channel'

// Isolated-world relay. Learns the MAIN script's per-load channel names from the
// handshake, then carries page requests out to the service worker and carries
// its answers and wallet-initiated notifications back in, dispatching both on
// the response channel.
let requestEventName: Nullable<string> = null
let responseEventName: Nullable<string> = null

// A prerendered page is not frame 0 until it activates, and the worker answers
// only the top frame, so its requests wait for activation instead of being refused.
const whenActivated = (run: () => void): void => {
    if (!(document as Document & { prerendering?: boolean }).prerendering) {
        run()
        return
    }
    document.addEventListener('prerenderingchange', run, { once: true })
}

const onRequest = (e: Event): void => {
    const { id, request, provider } = (e as CustomEvent)
        .detail as DappBridgeRequestEnvelope
    if (!isDappProvider(provider)) return
    whenActivated(() => forwardSafely(id, request, provider))
}

const forwardSafely = (
    id: string,
    request: unknown,
    provider: DappProvider,
): void => {
    try {
        forwardRequest(id, request, provider)
    } catch {
        // Extension context invalidated: the page outlived an extension reload
        // or update, and sendMessage throws SYNCHRONOUSLY rather than through
        // lastError. Nothing can ever answer this request, so it is answered
        // here rather than left to MAIN's backstop, which a queued EIP-1193
        // method waits out for nearly twenty minutes.
        answerUnreachable(id, request, provider)
    }
}

const UNREACHABLE_CODE: Record<DappProvider, number> = {
    pera: JsonRpcErrorCode.RequestTimedOut,
    eip1193: EIP1193_ERROR_CODE.disconnected,
}

const answerUnreachable = (
    id: string,
    request: unknown,
    provider: DappProvider,
): void => {
    if (!responseEventName) return
    const rpcId =
        typeof request === 'object' && request !== null && 'id' in request
            ? (request as { id: unknown }).id
            : id
    window.dispatchEvent(
        new CustomEvent(responseEventName, {
            detail: {
                id,
                provider,
                response: {
                    jsonrpc: '2.0',
                    id: rpcId,
                    error: {
                        code: UNREACHABLE_CODE[provider],
                        message:
                            'The wallet extension was reloaded; reload the page',
                    },
                },
            } satisfies DappBridgeResponseEnvelope,
        }),
    )
}

const hasUserActivation = (): boolean =>
    (navigator as Navigator & { userActivation?: { isActive: boolean } })
        .userActivation?.isActive === true

const forwardRequest = (
    id: string,
    request: unknown,
    provider: DappProvider,
): void => {
    chrome.runtime.sendMessage(
        // Read here, in the ISOLATED world: a page script cannot alter this
        // world's view of the window's user-activation state.
        {
            scope: DAPP_PAGE_REQUEST_SCOPE,
            provider,
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
                        provider,
                        response: ack.response,
                    } satisfies DappBridgeResponseEnvelope,
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
        const { payload, provider } = message
        const detail:
            | DappBridgeResponseEnvelope
            | DappBridgeNotificationEnvelope =
            'id' in payload
                ? { id: String(payload.id), provider, response: payload }
                : { provider, notification: payload }
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
