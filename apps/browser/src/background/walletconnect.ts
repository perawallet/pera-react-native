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
    WC_CONTROL_SCOPE,
    isWcApprovalRequestMessage,
    isTrustedExtensionPageSender,
    type ApprovalWindowBridge,
    type WcAck,
} from '@perawallet/wallet-extension-platform-chrome'

export const WC_HEARTBEAT_ALARM = 'pera-wc-heartbeat'

// Chrome clamps alarm periods to 1 minute minimum for packed extensions.
// One minute is the cheapest cadence that keeps a revived socket's downtime
// bounded without polling harder than the bridge needs.
const WC_HEARTBEAT_PERIOD_MINUTES = 1

/**
 * Bridges the offscreen WC host to the approval surface. Offscreen cannot
 * open windows (no chrome.windows there), so it asks the service worker,
 * which owns ApprovalWindowBridge — the same bridge ARC-0027 already uses.
 */
export const installWcApprovalRouter = ({
    approvals,
    chromeLike = chrome,
}: {
    approvals: ApprovalWindowBridge
    chromeLike?: typeof chrome
}): void => {
    chromeLike.runtime.onMessage.addListener(
        (message, sender, sendResponse) => {
            if (!isWcApprovalRequestMessage(message)) return false
            // Content scripts share onMessage with every extension page; only our
            // own extension-origin contexts may drive approvals.
            if (!isTrustedExtensionPageSender(sender, chromeLike)) return false

            const { request } = message
            // `kind` already separates the request types; the extra segment only
            // disambiguates several requests of the SAME kind on one connector,
            // which only `wc-sign` can have (one per WC request id). A connector
            // has at most one handshake, and offscreen keeps at most one error
            // surface open at a time.
            const requestId =
                request.kind === 'wc-sign'
                    ? `wc-wc-sign-${request.wcRequestId}-${request.clientId}`
                    : `wc-${request.kind}-${request.clientId}`

            // `deliver` only carries meaning for a `wc-sign` decision — a WC v1
            // handshake is completed via `approve-session`/`reject-session`
            // below, never `deliver`. Taking the sign request as an explicit,
            // narrowed parameter (rather than closing over the outer `request`)
            // means a future call site that passes a `wc-connect`-narrowed
            // `request` fails to compile — `wcRequestId` isn't a property of
            // that union member — instead of silently posting `wcRequestId: 0`.
            const post = (
                signRequest: Extract<typeof request, { kind: 'wc-sign' }>,
                outcome:
                    | { ok: true; result: unknown }
                    | { ok: false; message: string },
            ): void => {
                void chromeLike.runtime.sendMessage({
                    scope: WC_CONTROL_SCOPE,
                    kind: 'deliver',
                    clientId: signRequest.clientId,
                    wcRequestId: signRequest.wcRequestId,
                    outcome,
                })
            }

            if (request.kind === 'wc-connect') {
                void approvals
                    .openWcConnect({
                        requestId,
                        origin: request.origin,
                        clientId: request.clientId,
                        chainId: request.chainId,
                        // dApp-asserted display metadata for the approval header.
                        peerName: request.peerName,
                        peerIcons: request.peerIcons,
                        permissions: request.permissions,
                        // Browser-verified origin of the requesting tab (see
                        // `WcApprovalRequestMessage`'s `wc-connect.requesterOrigin`
                        // doc comment) — forwarded as-is, never defaulted from
                        // `request.origin`, which is the dApp's own forgeable
                        // `peerMeta.url` claim.
                        requesterOrigin: request.requesterOrigin,
                    })
                    .then(decision => {
                        // A WC v1 handshake is completed with approveSession /
                        // rejectSession, NOT with the deliver channel's
                        // approveRequest — and after Task 10 no UI surface owns a
                        // connector, so only the offscreen host can make those
                        // calls. Route the decision to it as its own control kind.
                        if (decision) {
                            void chromeLike.runtime.sendMessage({
                                scope: WC_CONTROL_SCOPE,
                                kind: 'approve-session',
                                clientId: request.clientId,
                                approvedAddresses: decision.approvedAddresses,
                                chainId: request.chainId,
                            })
                            return
                        }
                        void chromeLike.runtime.sendMessage({
                            scope: WC_CONTROL_SCOPE,
                            kind: 'reject-session',
                            clientId: request.clientId,
                        })
                    })
                    .catch((error: unknown) => {
                        // `windows.create` (inside openWcConnect) can reject.
                        // Its exact failure modes here aren't established —
                        // unlike `chrome.action.openPopup` (see approval-bridge.ts,
                        // which a reviewer confirmed resolves with no user
                        // gesture at all), nobody has verified what does or
                        // doesn't make `windows.create` itself reject in this
                        // codebase. Handled defensively regardless: without this,
                        // a rejection here is unhandled AND the offscreen host is
                        // left waiting on `pendingConnectApprovals` forever for
                        // this clientId (nothing ever answers its
                        // `requestApproval` call). Reject the handshake so the
                        // dApp gets a terminal response and this clientId can
                        // pair again instead of hanging silently.
                        console.error(
                            '[pera] wc-connect approval window failed to open:',
                            error,
                        )
                        void chromeLike.runtime.sendMessage({
                            scope: WC_CONTROL_SCOPE,
                            kind: 'reject-session',
                            clientId: request.clientId,
                        })
                    })
                // Ack acceptance, not the decision — that arrives later as its own
                // `approve-session`/`reject-session` control message. Waiting for
                // the surface here would deadlock the offscreen host, whose
                // `.catch` is specifically the "never reached a window" path.
                sendResponse({ ok: true } satisfies WcAck)
                return false
            }

            if (request.kind === 'wc-error') {
                // Notification-only: the handshake was already refused and the
                // peer already answered, so there is no decision to route
                // anywhere and nothing to reject on failure. The offscreen host
                // awaits this promise purely to know when the surface closed —
                // so unlike the two branches around it, this one answers on
                // dismissal rather than on acceptance. That is what makes
                // `wcHost`'s `errorSurfaceOpen` guard actually hold one surface
                // open at a time instead of resetting a microtask later.
                void approvals
                    .openWcError({
                        requestId,
                        origin: request.origin,
                        clientId: request.clientId,
                        reason: request.reason,
                        requestedChainId: request.requestedChainId,
                        activeNetwork: request.activeNetwork,
                    })
                    .catch((error: unknown) => {
                        console.error(
                            '[pera] wc-error surface failed to open:',
                            error,
                        )
                    })
                    // `finally`, not `then`: a surface that failed to open is
                    // just as "closed" as one the user dismissed, and leaving the
                    // guard latched would block every later notice.
                    .finally(() => sendResponse({ ok: true } satisfies WcAck))
                return true // async sendResponse — keep the port open until dismissal
            }

            void approvals
                .openWcSign({
                    requestId,
                    origin: request.origin,
                    clientId: request.clientId,
                    wcRequestId: request.wcRequestId,
                    method: request.method,
                    payload: request.payload,
                })
                .then(decision => {
                    if (decision) {
                        post(request, { ok: true, result: decision.result })
                    } else {
                        post(request, {
                            ok: false,
                            message: 'Request declined',
                        })
                    }
                })
                .catch((error: unknown) => {
                    // Same reasoning as the wc-connect catch above: an unhandled
                    // `windows.create` rejection here would leave the dApp
                    // request answered by nobody. Answer it as a decline.
                    console.error(
                        '[pera] wc-sign approval window failed to open:',
                        error,
                    )
                    post(request, {
                        ok: false,
                        message: 'Approval window failed to open',
                    })
                })
            // Acceptance ack — the decision travels back over the `deliver`
            // control message, same reasoning as the wc-connect branch above.
            sendResponse({ ok: true } satisfies WcAck)
            return false
        },
    )
}

/**
 * Wakes the service worker on a fixed cadence so it can re-ensure the
 * offscreen document and ask it to sweep dead sockets. Mobile's equivalent
 * trigger is an AppState foreground transition, which never fires on web.
 */
export const installWcHeartbeat = ({
    chromeLike = chrome,
}: {
    chromeLike?: typeof chrome
}): void => {
    // Only create the alarm if it doesn't already exist. `alarms.create`
    // REPLACES a same-named alarm, resetting its period to a full interval
    // from now — and this runs at module scope on every service-worker wake.
    // A page that wakes the worker more often than the period (any dApp
    // polling, any popup open) would otherwise postpone the reconnect sweep
    // indefinitely, so a WC socket that died stayed dead.
    void (async () => {
        try {
            const existing = await chromeLike.alarms.get(WC_HEARTBEAT_ALARM)
            if (existing) return
            await chromeLike.alarms.create(WC_HEARTBEAT_ALARM, {
                periodInMinutes: WC_HEARTBEAT_PERIOD_MINUTES,
            })
        } catch (error) {
            console.error('[pera] wc heartbeat alarm setup failed:', error)
        }
    })()
}
