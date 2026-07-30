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

import { isTrustedExtensionPageSender } from '../trusted-sender'
import {
    WC_CONTROL_SCOPE,
    WC_PAIR_OUTCOME_SCOPE,
    WC_REQUEST_SCOPE,
    isWcPairOutcomeMessage,
    type WcApprovalRequestMessage,
    type WcControlMessage,
    type WcPairOutcomeMessage,
} from './protocol'

export const sendWcApprovalRequest = async (
    request: WcApprovalRequestMessage['request'],
): Promise<void> => {
    await chrome.runtime.sendMessage({ scope: WC_REQUEST_SCOPE, request })
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
 * `apps/extension/src/background/walletconnect.ts`'s `installWcApprovalRouter`
 * (the service worker's approval router, downstream of the approval surface
 * a `wc-connect` request opens) sends `approve-session`/`reject-session`.
 * `useWalletConnectProvider.web.tsx` and `ConnectionView.web.tsx` were an
 * earlier, since-deleted approach — no UI surface calls `useWalletConnect`
 * on web today.
 */
export const sendWcControlMessage = async (
    message: DistributiveOmit<WcControlMessage, 'scope'>,
): Promise<void> => {
    await chrome.runtime.sendMessage({ scope: WC_CONTROL_SCOPE, ...message })
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
    ): boolean => {
        if (isTrustedExtensionPageSender(sender)) handler(message)
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
    await chrome.runtime.sendMessage({
        scope: WC_PAIR_OUTCOME_SCOPE,
        ...message,
    })
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
