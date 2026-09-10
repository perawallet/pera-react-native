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
    isConnectionApprovalRequestMessage,
    isTrustedExtensionPageSender,
    sendConnectionsControlMessage,
    type ApprovalWindowBridge,
    type ConnectionsAck,
    type ConnectionsControlCommand,
} from '@perawallet/wallet-extension-platform-chrome'
import type { ConnectionPeer } from '@perawallet/wallet-extension-connections'
import { ensureOffscreenDocument } from './offscreen'

export const CONNECTIONS_HEARTBEAT_ALARM = 'pera-connections-heartbeat'
const LEGACY_HEARTBEAT_ALARM = 'pera-wc-heartbeat'

// Chrome clamps alarm periods to 1 minute minimum for packed extensions.
const CONNECTIONS_HEARTBEAT_PERIOD_MINUTES = 1

// dApp-asserted, display only; the browser-verified origin is `requesterOrigin`.
const peerOrigin = (peer: ConnectionPeer | undefined): string => {
    if (!peer?.url) return ''
    try {
        return new URL(peer.url).origin
    } catch {
        return ''
    }
}

// Offscreen documents cannot open windows, so approval requests are relayed to
// the service worker, which owns ApprovalWindowBridge.
export const installConnectionsApprovalRouter = ({
    approvals,
    chromeLike = chrome,
    ensureOffscreenDocumentLike = ensureOffscreenDocument,
}: {
    approvals: ApprovalWindowBridge
    chromeLike?: typeof chrome
    ensureOffscreenDocumentLike?: () => Promise<void>
}): void => {
    // Every user decision travels this way, and the approval window has already
    // closed on success, so an unanswered send is a dApp that never hears back.
    // The retry budget covers the offscreen document being recreated under it
    // (`runOffscreenApp` closes the window when the DB worker dies); the
    // ensure step is the service worker's own, not the UI realm's ping to it.
    //
    // Resolves false when the command did not take: the budget ran out, or the
    // host answered `{ ok: false }` because delivery to the peer failed (dead
    // WalletConnect socket, expired handshake). Dropped, that reads to the user
    // as success.
    const control = async (
        command: ConnectionsControlCommand,
    ): Promise<boolean> => {
        try {
            await sendConnectionsControlMessage(command, {
                chromeLike,
                ensureHost: () => ensureOffscreenDocumentLike(),
            })
            return true
        } catch (error) {
            console.error(
                `[pera] connections control '${command.kind}' failed:`,
                error,
            )
            return false
        }
    }

    // The decision window is gone by now, so this notice is the only surface
    // left; without it the user is told nothing and assumes the dApp heard.
    const notifyDeliveryFailed = (peer: ConnectionPeer | undefined): void => {
        void approvals
            .openConnectionError({
                requestId: `connection-error-${crypto.randomUUID()}`,
                origin: peerOrigin(peer),
                faviconUrl: peer?.icons?.[0],
                reason: 'delivery-failed',
                peer,
            })
            .catch((error: unknown) => {
                console.error(
                    '[pera] delivery-failure notice failed to open:',
                    error,
                )
            })
    }

    const controlOrNotify = (
        command: ConnectionsControlCommand,
        peer: ConnectionPeer | undefined,
    ): void => {
        void control(command).then(delivered => {
            if (!delivered) notifyDeliveryFailed(peer)
        })
    }

    chromeLike.runtime.onMessage.addListener(
        (message, sender, sendResponse) => {
            if (!isConnectionApprovalRequestMessage(message)) return false
            // onMessage is shared with content scripts; only extension-origin contexts may drive approvals.
            if (!isTrustedExtensionPageSender(sender, chromeLike)) return false

            const { request } = message
            switch (request.kind) {
                case 'connection-proposal': {
                    const { proposalId } = request
                    void approvals
                        .openConnectionProposal({
                            requestId: `connection-proposal-${proposalId}`,
                            origin: peerOrigin(request.peer),
                            faviconUrl: request.peer.icons?.[0],
                            proposalId,
                            connectionKind: request.connectionKind,
                            peer: request.peer,
                            requested: request.requested,
                            expiresAt: request.expiresAt,
                            requesterOrigin: request.requesterOrigin,
                        })
                        .then(decision => {
                            controlOrNotify(
                                decision
                                    ? {
                                          kind: 'approve-proposal',
                                          proposalId,
                                          accounts: decision.approvedAddresses,
                                      }
                                    : { kind: 'reject-proposal', proposalId },
                                request.peer,
                            )
                        })
                        .catch((error: unknown) => {
                            // Nothing else answers the peer if the window never opened.
                            console.error(
                                '[pera] connection-proposal approval window failed to open:',
                                error,
                            )
                            void control({
                                kind: 'reject-proposal',
                                proposalId,
                                reason: 'Approval window failed to open',
                            })
                        })
                    // Acks acceptance; the decision travels back on the control scope.
                    sendResponse({ ok: true } satisfies ConnectionsAck)
                    return false
                }
                case 'connection-request': {
                    const { connectionId, correlationId } = request
                    void approvals
                        .openConnectionRequest({
                            requestId: `connection-request-${connectionId}-${correlationId}`,
                            origin: peerOrigin(request.peer),
                            faviconUrl: request.peer.icons?.[0],
                            connectionId,
                            correlationId,
                            operation: request.operation,
                            authorizedAccounts: request.authorizedAccounts,
                            peer: request.peer,
                        })
                        .then(decision => {
                            controlOrNotify(
                                {
                                    kind: 'respond',
                                    connectionId,
                                    correlationId,
                                    outcome: decision
                                        ? { ok: true, result: decision.result }
                                        : {
                                              ok: false,
                                              message: 'Request declined',
                                          },
                                },
                                request.peer,
                            )
                        })
                        .catch((error: unknown) => {
                            console.error(
                                '[pera] connection-request approval window failed to open:',
                                error,
                            )
                            void control({
                                kind: 'respond',
                                connectionId,
                                correlationId,
                                outcome: {
                                    ok: false,
                                    message: 'Approval window failed to open',
                                },
                            })
                        })
                    sendResponse({ ok: true } satisfies ConnectionsAck)
                    return false
                }
                case 'connection-error': {
                    void approvals
                        .openConnectionError({
                            requestId: `connection-error-${request.pairingId ?? crypto.randomUUID()}`,
                            origin: peerOrigin(request.peer),
                            faviconUrl: request.peer?.icons?.[0],
                            reason: request.reason,
                            peer: request.peer,
                            activeNetwork: request.activeNetwork,
                        })
                        .catch((error: unknown) => {
                            console.error(
                                '[pera] connection-error surface failed to open:',
                                error,
                            )
                        })
                        // The host holds one notice open at a time, so a surface that
                        // failed to open must ack as closed too.
                        .finally(() =>
                            sendResponse({ ok: true } satisfies ConnectionsAck),
                        )
                    return true
                }
            }
        },
    )
}

// Web has no AppState foreground event to trigger a reconnect sweep, so an
// alarm wakes the service worker on a fixed cadence instead.
export const installConnectionsHeartbeat = ({
    chromeLike = chrome,
}: {
    chromeLike?: typeof chrome
}): void => {
    // `alarms.create` REPLACES a same-named alarm and restarts its period, and
    // this runs on every service-worker wake, so an existing alarm is left alone.
    void (async () => {
        try {
            // An orphaned legacy alarm would fire into the auto-lock handler forever.
            await chromeLike.alarms.clear(LEGACY_HEARTBEAT_ALARM)
            const existing = await chromeLike.alarms.get(
                CONNECTIONS_HEARTBEAT_ALARM,
            )
            if (existing) return
            await chromeLike.alarms.create(CONNECTIONS_HEARTBEAT_ALARM, {
                periodInMinutes: CONNECTIONS_HEARTBEAT_PERIOD_MINUTES,
            })
        } catch (error) {
            console.error(
                '[pera] connections heartbeat alarm setup failed:',
                error,
            )
        }
    })()
}
