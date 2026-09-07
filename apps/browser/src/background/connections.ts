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
    CONNECTIONS_CONTROL_SCOPE,
    isConnectionApprovalRequestMessage,
    isTrustedExtensionPageSender,
    type ApprovalWindowBridge,
    type ConnectionsAck,
    type ConnectionsControlCommand,
} from '@perawallet/wallet-extension-platform-chrome'
import type { ConnectionPeer } from '@perawallet/wallet-extension-connections'

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
}: {
    approvals: ApprovalWindowBridge
    chromeLike?: typeof chrome
}): void => {
    // A raw send, not `sendConnectionsControlMessage`: its ensure-offscreen
    // ping is a message the service worker would be sending to itself.
    const control = (command: ConnectionsControlCommand): void => {
        void chromeLike.runtime
            .sendMessage({ scope: CONNECTIONS_CONTROL_SCOPE, ...command })
            .catch((error: unknown) => {
                console.error(
                    `[pera] connections control '${command.kind}' failed:`,
                    error,
                )
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
                            if (decision) {
                                control({
                                    kind: 'approve-proposal',
                                    proposalId,
                                    accounts: decision.approvedAddresses,
                                })
                            } else {
                                control({ kind: 'reject-proposal', proposalId })
                            }
                        })
                        .catch((error: unknown) => {
                            // Nothing else answers the peer if the window never opened.
                            console.error(
                                '[pera] connection-proposal approval window failed to open:',
                                error,
                            )
                            control({
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
                            control({
                                kind: 'respond',
                                connectionId,
                                correlationId,
                                outcome: decision
                                    ? { ok: true, result: decision.result }
                                    : {
                                          ok: false,
                                          message: 'Request declined',
                                      },
                            })
                        })
                        .catch((error: unknown) => {
                            console.error(
                                '[pera] connection-request approval window failed to open:',
                                error,
                            )
                            control({
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
