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

import { DB_CONTROL_SCOPE } from '../database/protocol'
import { isTrustedExtensionPageSender } from '../trusted-sender'

import {
    WC_CONTROL_SCOPE,
    WC_ERROR_NOTICE_SCOPE,
    WC_PAIR_OUTCOME_SCOPE,
    WC_REQUEST_SCOPE,
    isWcAck,
    isWcErrorNoticeMessage,
    isWcPairOutcomeMessage,
    type WcAck,
    type WcErrorNoticeMessage,
    type WcApprovalRequestMessage,
    type WcControlMessage,
    type WcPairOutcomeMessage,
} from './protocol'

/**
 * Asks the service worker to (re)create the offscreen document, and resolves
 * once it has — or immediately if the request can't be delivered.
 *
 * Best-effort on purpose: only the SW can call `chrome.offscreen`, so a UI
 * surface has to route through it, and a failure here should not pre-empt the
 * caller's own error handling for the command it actually wanted to send.
 * Creation is idempotent, so calling this before every control message is
 * safe if slightly redundant.
 */
const ensureOffscreenHost = async (): Promise<void> => {
    try {
        await chrome.runtime.sendMessage({
            scope: DB_CONTROL_SCOPE,
            kind: 'ensure-offscreen',
        })
    } catch {
        // Nothing answered (SW mid-restart). The send itself wakes it, and the
        // control message below reports the real outcome.
    }
}

/**
 * Sends an approval request to the service worker's `installWcApprovalRouter`
 * and resolves on its ack. What the ack *means* differs per kind and is the
 * whole point of awaiting this — see {@link WcAck}: `wc-connect`/`wc-sign`
 * ack acceptance (their decisions come back later on the control channel),
 * while `wc-error` acks dismissal, which is what lets the caller hold at most
 * one error surface open at a time.
 *
 * Throws when nothing handled the request — the router is gone, or the
 * service worker died before answering. That is a real failure the caller
 * must see: it means no approval surface will ever resolve this request.
 */
export const sendWcApprovalRequest = async (
    request: WcApprovalRequestMessage['request'],
): Promise<void> => {
    const response: unknown = await chrome.runtime.sendMessage({
        scope: WC_REQUEST_SCOPE,
        request,
    })
    if (!isWcAck(response)) {
        throw new Error(
            `WalletConnect approval request '${request.kind}' was not acknowledged`,
        )
    }
}

/**
 * `Omit<T, K>` does not distribute over a union: `keyof WcControlMessage`
 * only sees the keys common to every variant (`scope`, `kind`), so a plain
 * `Omit<WcControlMessage, 'scope'>` collapses every variant down to just
 * `{ kind }` and rejects any variant-specific field (`clientId`, `uri`, …).
 * Distributing the `Omit` over each member first (`T extends unknown ? … :
 * never` forces the conditional to apply per-member instead of to the union
 * as a whole) keeps each variant's own fields intact.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
    ? Omit<T, K>
    : never

/**
 * Sends a WC control message (pair, disconnect, approve-session,
 * reject-session, …) to whichever context is running `startWcHost` —
 * currently the offscreen document. UI surfaces use this instead of owning
 * a connector themselves: `useWalletConnectPairing.web.ts` sends `pair`,
 * `useWalletConnectSessionsControl.web.ts` sends `disconnect`, and
 * `apps/browser/src/background/walletconnect.ts`'s `installWcApprovalRouter`
 * (the service worker's approval router, downstream of the approval surface
 * a `wc-connect` request opens) sends `approve-session`/`reject-session`.
 * `useWalletConnectProvider.web.tsx` and `ConnectionView.web.tsx` were an
 * earlier, since-deleted approach — no UI surface calls `useWalletConnect`
 * on web today.
 */
export const sendWcControlMessage = async (
    message: DistributiveOmit<WcControlMessage, 'scope'>,
): Promise<void> => {
    // The offscreen document is the only host for these commands, and it may
    // be absent — it self-closes after a db-worker death, and a cold browser
    // start can deliver a UI action before the service worker has re-created
    // it. Asking the SW to ensure it first is what the page-initiated pair
    // route already does ("rather than dropping the very first pair on a cold
    // start", connect-modal-pair.ts); without it the UI route was a
    // works-on-the-second-try bug, and now that an unanswered send is a hard
    // error it would be a deterministic failure instead.
    await ensureOffscreenHost()
    const response: unknown = await chrome.runtime.sendMessage({
        scope: WC_CONTROL_SCOPE,
        ...message,
    })
    // No ack means no host consumed it — in practice the offscreen document
    // is absent (self-closed after a worker death, or not yet recreated on a
    // cold start). Surfacing that is the point: the connector command did not
    // happen, and a caller that treated the send as success would report a
    // pairing or disconnect that never occurred.
    if (!isWcAck(response)) {
        throw new Error(
            `WalletConnect control message '${message.kind}' was not handled`,
        )
    }
}

/**
 * Subscribes a WC control-message handler. The handler returns true when it
 * consumed the message; this wrapper always returns false to chrome so other
 * listeners (DB control, approval bridge) still see unrelated traffic.
 *
 * Threat model: content scripts share chrome.runtime.onMessage with every
 * extension page. This channel carries `approve-session` with caller-chosen
 * `approvedAddresses`, so an untrusted sender must never reach `handler` —
 * gated the same way as every other `onMessage` host in this repo (see
 * `../trusted-sender.ts`'s doc comment for the threat model, and
 * `../database/host.ts` / `../storage-proxy.ts` / `../dapp/approval-bridge.ts`
 * for the sibling gates).
 *
 * Returns an unsubscribe function, mirroring `onLocalStorageKeyChanged` —
 * lets a caller drop the previous listener before registering a new one
 * instead of accumulating duplicates on the same handler.
 */
export const onWcControlMessage = (
    handler: (message: unknown) => boolean,
): (() => void) => {
    const listener = (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: WcAck) => void,
    ): boolean => {
        if (!isTrustedExtensionPageSender(sender)) return false
        // The handler's own "I consumed this" return is what the ack reports;
        // staying silent on an unconsumed message is how the sender learns
        // no host owns it (see sendWcControlMessage).
        if (!handler(message)) return false
        sendResponse({ ok: true })
        return false
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
}

/**
 * Offscreen-side sender for the `pair-outcome` broadcast (see
 * {@link WcPairOutcomeMessage}'s doc comment for why it's a separate scope
 * from {@link WC_CONTROL_SCOPE}). Best-effort: if no UI realm is listening
 * (the popup that started the pairing already closed), `chrome.runtime.
 * sendMessage` resolving or rejecting either way is fine — nothing is
 * waiting on this specific delivery succeeding, only the caller's own
 * bounded wait, which times out on its own if this never arrives.
 */
export const sendPairOutcome = async (
    message: Omit<WcPairOutcomeMessage, 'scope'>,
): Promise<void> => {
    try {
        await chrome.runtime.sendMessage({
            scope: WC_PAIR_OUTCOME_SCOPE,
            ...message,
        })
    } catch {
        // Swallowed on purpose, and only here: "nobody is listening" is the
        // normal steady state for this broadcast (the popup that started the
        // pairing has usually closed by now), and Chrome reports it as a
        // rejection. The caller's bounded wait is the real timeout. Contrast
        // sendWcControlMessage / sendWcApprovalRequest, where an unanswered
        // send means a command or approval genuinely did not happen and must
        // propagate.
    }
}

/**
 * Subscribes a `pair-outcome` handler, gated the same way as
 * {@link onWcControlMessage}: content scripts share `chrome.runtime.
 * onMessage` with every extension page, and this channel drives a UI-visible
 * error toast, so an untrusted sender must never reach `handler` — a content
 * script spoofing a `pair-outcome` could otherwise fabricate a false error
 * for a pairing attempt it didn't make.
 */
export const onPairOutcome = (
    handler: (message: WcPairOutcomeMessage) => void,
): (() => void) => {
    const listener = (
        message: unknown,
        sender: chrome.runtime.MessageSender,
    ): boolean => {
        if (
            isTrustedExtensionPageSender(sender) &&
            isWcPairOutcomeMessage(message)
        ) {
            handler(message)
        }
        return false
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
}

/**
 * Offscreen-side sender for a connector-level failure (see
 * {@link WcErrorNoticeMessage}). Best-effort for the same reason
 * {@link sendPairOutcome} is: when every UI realm is closed there is nobody to
 * tell, and Chrome reports that as a rejection.
 */
export const sendWcErrorNotice = async (
    notice: Omit<WcErrorNoticeMessage, 'scope'>,
): Promise<void> => {
    try {
        await chrome.runtime.sendMessage({
            scope: WC_ERROR_NOTICE_SCOPE,
            ...notice,
        })
    } catch {
        // No UI realm open — the failure is still recorded in the offscreen
        // log; there is simply no one to show it to.
    }
}

/**
 * Subscribes a UI realm to connector-level failures, gated the same way as
 * {@link onPairOutcome}: a content script shares `chrome.runtime.onMessage`
 * with every extension page, and this drives a user-visible error toast, so an
 * untrusted sender must never reach `handler`.
 */
export const onWcErrorNotice = (
    handler: (notice: WcErrorNoticeMessage) => void,
): (() => void) => {
    const listener = (
        message: unknown,
        sender: chrome.runtime.MessageSender,
    ): boolean => {
        if (!isTrustedExtensionPageSender(sender)) return false
        if (!isWcErrorNoticeMessage(message)) return false
        handler(message)
        return false
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
}
