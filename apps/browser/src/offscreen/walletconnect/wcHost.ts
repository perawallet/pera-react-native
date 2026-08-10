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

import { logger, type Network } from '@perawallet/wallet-core-shared'
import {
    WC_CONTROL_SCOPE,
    isWcControlMessage,
    type WcControlMessage,
    type WcPairOutcome,
} from '@perawallet/wallet-extension-platform-chrome'
import {
    WC_DELIVERY_TIMEOUT_MS,
    WC_SESSION_OUTCOME_TIMEOUT_MS,
    ensureConnectorReady,
    forgetConnector,
    getConnector,
    isChainIdAcceptable,
    reconnectAllConnectors,
    registerConnector,
    setConnectorHandlerBinder,
    type WalletConnectConnection,
} from '@perawallet/wallet-core-walletconnect'
import {
    bindHeadlessHandlers,
    type HeadlessWcConnector,
} from './bindHeadlessHandlers'
import { buildApprovedConnection } from './approvedConnection'

export type WcApprovalRequest =
    | {
          kind: 'wc-connect'
          clientId: string
          chainId: number
          // dApp-asserted `peerMeta.url` origin — the WalletConnect
          // handshake's own claim, which a page can forge.
          origin: string
          // Also dApp-asserted, and carried for the same reason: the approval
          // surface renders the same header mobile's ConnectionView does, which
          // shows the peer's name and icon alongside the requested permissions.
          // Display only — never a trust signal.
          peerName?: string
          peerIcons?: string[]
          permissions?: string[]
          // Browser-verified origin of the tab that requested this pairing
          // (see `WcControlMessage`'s `pair.requesterOrigin`). Absent for
          // user-initiated pairings. Never conflate with `origin` above —
          // different trust levels.
          requesterOrigin?: string
      }
    | {
          kind: 'wc-sign'
          clientId: string
          wcRequestId: number
          method: 'algo_signTxn' | 'algo_signData'
          payload: unknown
          origin: string
      }
    /**
     * Notification-only, for a handshake this host already refused. Carries no
     * decision: `requestApproval` resolves when the user dismisses the
     * surface, which is all the host uses it for (see `errorSurfaceOpen`).
     */
    | {
          kind: 'wc-error'
          clientId: string
          reason: 'network-mismatch'
          origin: string
          requestedChainId?: number
          activeNetwork: string
      }

export type WcHostDeps = {
    network: () => Network
    knownAddresses: () => readonly string[]
    storedConnections: () => WalletConnectConnection[]
    requestApproval: (input: WcApprovalRequest) => Promise<void>
    createConnector: (options: {
        uri?: string
        session?: unknown
    }) => HeadlessWcConnector
    /**
     * Persists (or replaces, keyed by `clientId`) the record for a session
     * once its handshake is approved. Must only be called after
     * `connector.approveSession` has succeeded against a live socket — WC
     * v1 silently queues into a dead socket, so a write made before that
     * point would record a session the dApp never actually heard about.
     * Without this, the offscreen document is the sole holder of
     * `connector.session` and a restart loses the pairing entirely.
     */
    persistConnection: (connection: WalletConnectConnection) => void
    /**
     * Drops a session's persisted record once it ends (peer- or
     * user-initiated disconnect). Without this a dead session lingers in
     * the settings list forever and `reviveStoredSessions` keeps retrying
     * it on every future boot.
     */
    removeConnection: (clientId: string) => void
    /**
     * Reports how a correlated `pair` call resolved, so the web UI surface
     * that initiated it (`useWalletConnectPairing.web.ts`) can surface a
     * failure instead of assuming success the moment the control message
     * was delivered. Best-effort — see `sendPairOutcome`'s own doc comment
     * for why a delivery failure here is never itself treated as fatal.
     */
    sendPairOutcome: (input: {
        correlationId: string
        outcome: WcPairOutcome
    }) => Promise<void>
}

export type WcHost = {
    /** Returns true when the message was a WC control message it consumed. */
    handleControlMessage: (message: unknown) => boolean
    reviveStoredSessions: () => void
}

/**
 * The registry (`registerConnector` et al.) is typed against the real
 * `@perawallet/walletconnect` class, which this file can't name directly
 * (see `HeadlessWcConnector`'s doc comment). `Parameters<>` recovers that
 * type from an already-imported function instead of importing the module
 * by name, so this stays a `HeadlessWcConnector` → registry boundary cast
 * rather than a reference to an unresolvable module.
 */
type RegistryConnector = Parameters<typeof registerConnector>[1]

const peerOrigin = (peerMeta: unknown): string => {
    const url = (peerMeta as { url?: unknown } | undefined)?.url
    if (typeof url !== 'string') return ''
    try {
        return new URL(url).origin
    } catch {
        return ''
    }
}

/**
 * dApp-asserted display name from the handshake's `peerMeta`. Forgeable, like
 * every other `peerMeta` field — carried so the approval surface can render the
 * same header mobile does, never as a trust signal (that's `requesterOrigin`).
 */
const peerName = (peerMeta: unknown): string | undefined => {
    const name = (peerMeta as { name?: unknown } | undefined)?.name
    return typeof name === 'string' && name.length > 0 ? name : undefined
}

const PEER_ICON_LIMIT = 8

/**
 * dApp-asserted icon URLs. Filtered to strings so a peer can't put arbitrary
 * structures on the message, and capped: `peerMeta.icons` is unbounded
 * peer-controlled input, and the surface only ever renders the first match.
 */
const peerIcons = (peerMeta: unknown): string[] => {
    const icons = (peerMeta as { icons?: unknown } | undefined)?.icons
    if (!Array.isArray(icons)) return []
    return icons
        .filter((icon): icon is string => typeof icon === 'string')
        .slice(0, PEER_ICON_LIMIT)
}

const describeError = (error: unknown): string =>
    error instanceof Error ? error.message : 'Failed to create connector'

/**
 * The offscreen document's WC ownership. Long-lived by construction: the
 * offscreen document outlives every UI surface, so a session paired here
 * keeps its bridge socket after the popup closes.
 *
 * Signing never happens here — the vault is deliberately absent from this
 * context. Gate survivors are forwarded to the service worker, which opens
 * an approval surface; that surface signs and the decision comes back as a
 * `deliver` control message.
 */
export const startWcHost = (deps: WcHostDeps): WcHost => {
    /**
     * Connect approvals in flight, keyed by `clientId`. A dApp's socket can
     * re-fire `session_request` on the same connector before the first
     * approval resolves (the router derives the approval id from `clientId`
     * alone for `wc-connect`, so a second request would collide with the
     * first in `ApprovalWindowBridge.awaitApproval`'s pending map and
     * silently orphan its promise). Guarding here, keyed per `clientId`,
     * drops the duplicate instead: the first approval window is already
     * open and is the one the user is looking at.
     *
     * Cleared on every path that concludes the handshake for that
     * `clientId` — `approveSession`, `rejectSession`, `disconnect`, the
     * peer-initiated `onDisconnect` below, and a failed
     * `requestApproval` post — so a declined, expired, or dropped session
     * can always pair again on the same connector.
     *
     * Keyed to the `permissions` from the triggering `session_request`
     * rather than a bare presence flag: `approveSession` needs them to
     * build the persisted `WalletConnectConnection.session.permissions`
     * field, mirroring `useWalletConnect.approveSession`, which reads
     * `permissions` off the original `WalletConnectSessionRequest` it was
     * handed rather than re-deriving them from a stored snapshot.
     */
    const pendingConnectApprovals = new Map<string, string[]>()

    /**
     * `correlationId` → `clientId`'s inverse: `clientId` → `correlationId`
     * for a `pair()` call that asked to be told the outcome, alongside a
     * cleanup timer armed the moment the entry is created (see
     * `armPairingCorrelation`). Populated once `createConnector` gives us a
     * `clientId` to key on (before that, a construction throw has no
     * `clientId` to record against — the error outcome is sent straight
     * from `pair`'s catch instead).
     *
     * Also carries this pairing's `requesterOrigin` — the browser-verified
     * origin of the tab that asked for the pairing (see `WcControlMessage`'s
     * `pair.requesterOrigin` doc comment for how it differs from the
     * dApp-asserted `peerMeta` origin). It rides the same per-`clientId`
     * entry as `correlationId` rather than a second map because the two are
     * both per-pairing metadata with the exact same lifetime: retained from
     * `pair()` until the connector's first `session_request` reads it back
     * out onto the `wc-connect` approval request. Either field alone is
     * enough to arm an entry — a `pair()` call may carry a `correlationId`
     * with no `requesterOrigin` (user-initiated pairing wanting an outcome)
     * or a `requesterOrigin` with no `correlationId`, and `resolvePairOutcome`
     * only ever sends an outcome when `correlationId` is actually present.
     *
     * Cleared *early* — before its own timer fires — on every path that
     * READS it back: `onSessionRequest`'s first call (the only place
     * `requesterOrigin` is ever consumed) and the network-mismatch branch,
     * plus the abandonment paths that precede either ever running — a
     * failed `adopt`, and disconnect/peer-`onDisconnect` for a connector
     * that never got that far. `approve-session` and `reject-session` need
     * NOT clear it: both conclude a handshake that only exists because
     * `onSessionRequest` already ran for this `clientId` (it's what opens
     * the approval window they're resolving), and that run already cleared
     * this entry per the above — so by the time either message can arrive,
     * this map has nothing left for that `clientId` to hold. It does NOT
     * cover a dead WC v1 bridge: a socket that never emits `session_request`
     * or `disconnect` touches none of those paths, and WC v1 bridges were
     * largely sunset in mid-2024 — a scanned QR whose bridge already 404s
     * is the dominant failure mode this host has to expect, not an edge
     * case. Without its own bound, that entry would sit in this map for the
     * rest of the offscreen document's (session-long) lifetime.
     *
     * The timer is that bound: armed for `WC_SESSION_OUTCOME_TIMEOUT_MS`
     * (the same budget every caller's own wait — `waitForSessionOutcome`
     * natively, `waitForPairOutcome` on web — already uses) plus
     * `PAIRING_CORRELATION_CLEANUP_SLACK_MS`, so it only ever fires after
     * the caller has already stopped listening and settled its own
     * promise as `timeout`. On fire it just deletes the entry — no outcome
     * is sent, since the caller isn't waiting for one anymore.
     */
    const pairingCorrelations = new Map<
        string,
        {
            correlationId?: string
            requesterOrigin?: string
            cleanupTimer: ReturnType<typeof setTimeout>
        }
    >()

    /** How much longer than the caller's own outcome-wait budget this
     * host's leak-prevention timer waits before giving up on an entry —
     * purely so the caller's own timeout always loses the race first. */
    const PAIRING_CORRELATION_CLEANUP_SLACK_MS = 2000

    /** Cancels and drops a `clientId`'s pending correlation, if any — the
     * shared "clear early" step every terminal path below performs. */
    const clearPairingCorrelation = (clientId: string): void => {
        const entry = pairingCorrelations.get(clientId)
        if (entry === undefined) return
        clearTimeout(entry.cleanupTimer)
        pairingCorrelations.delete(clientId)
    }

    const armPairingCorrelation = (
        clientId: string,
        // `correlationId` (caller-chosen bookkeeping) and `requesterOrigin`
        // (browser-verified, rendered to the user as trusted) are adjacent
        // `string | undefined` fields — bundled into one object so a
        // positional swap between them is a compile error, not a silent
        // mislabel of a trust-bearing value.
        correlation: { correlationId?: string; requesterOrigin?: string },
    ): void => {
        const { correlationId, requesterOrigin } = correlation
        // Defensive, belt-and-suspenders: `pair()` — this function's sole
        // caller — already unconditionally clears any previous entry for
        // this `clientId` before ever reaching this call (see `pair()`'s own
        // comment for why that clear must be unconditional regardless of
        // which fields the new pairing carries). Clearing again here costs
        // nothing when that invariant holds, and stays correct if it ever
        // stops holding — e.g. before the no-op session-storage fix in
        // `createConnector.ts`: the real SDK's `session` setter reads
        // `opts.session ?? this._getStorageSession()` unconditionally in its
        // constructor, so a `pair()` call could once adopt a stale `clientId`
        // left in `window.localStorage` by an unrelated prior pairing. Left
        // in place as a guard against that class of bug returning — without
        // clearing the old timer first, both timers would stay live keyed to
        // the same map slot, and the FIRST one firing at its own (earlier)
        // deadline would delete whatever entry is in the map at that point,
        // which by then is the SECOND correlation, silently dropping a
        // still-live pairing's cleanup guarantee.
        clearPairingCorrelation(clientId)
        const cleanupTimer = setTimeout(() => {
            pairingCorrelations.delete(clientId)
        }, WC_SESSION_OUTCOME_TIMEOUT_MS + PAIRING_CORRELATION_CLEANUP_SLACK_MS)
        pairingCorrelations.set(clientId, {
            correlationId,
            requesterOrigin,
            cleanupTimer,
        })
    }

    const resolvePairOutcome = (clientId: string, outcome: WcPairOutcome) => {
        const entry = pairingCorrelations.get(clientId)
        if (entry === undefined) return
        clearPairingCorrelation(clientId)
        // No correlationId means the caller never asked to hear back (a
        // `requesterOrigin`-only entry, or none at all) — nothing to send.
        const { correlationId } = entry
        if (correlationId === undefined) return
        void deps.sendPairOutcome({ correlationId, outcome }).catch(error => {
            logger.warn('[wc-host] pair-outcome delivery failed', {
                clientId,
                correlationId,
                error,
            })
        })
    }

    /**
     * Looks up the *persisted* session's chainId for a `clientId`, never
     * the live connector's mutable field. See `HeadlessHandlerDeps.
     * sessionChainId`'s doc comment for why.
     */
    const sessionChainId = (clientId: string): number | undefined =>
        deps
            .storedConnections()
            .find(connection => connection.clientId === clientId)?.session
            ?.chainId

    /**
     * At most one wrong-network notice on screen at a time.
     *
     * A page can trigger `pair` at will: the connect-modal content channel is
     * page-visible by design, and the service worker's origin check proves
     * only that the sender is an http(s) tab — not that a user clicked
     * anything. Without this guard, a hostile page could force an endless run
     * of approval windows simply by pairing repeatedly on a chain the wallet
     * isn't on. Cleared when the surface closes: `requestApproval` for
     * `wc-error` resolves on dismissal rather than on a decision.
     */
    let errorSurfaceOpen = false

    const notifyNetworkMismatch = (input: {
        clientId: string
        chainId?: number
        peerMeta: unknown
    }): void => {
        if (errorSurfaceOpen) return
        errorSurfaceOpen = true
        void deps
            .requestApproval({
                kind: 'wc-error',
                clientId: input.clientId,
                reason: 'network-mismatch',
                origin: peerOrigin(input.peerMeta),
                requestedChainId: input.chainId,
                activeNetwork: deps.network(),
            })
            .catch((error: unknown) => {
                logger.error('[wc-host] network-mismatch notice failed', {
                    clientId: input.clientId,
                    error,
                })
            })
            .finally(() => {
                errorSurfaceOpen = false
            })
    }

    const bind = (connector: HeadlessWcConnector): void =>
        bindHeadlessHandlers(connector, {
            network: deps.network,
            knownAddresses: deps.knownAddresses,
            sessionChainId,
            onSessionRequest: ({
                clientId,
                chainId,
                peerMeta,
                permissions,
            }) => {
                // Read before `resolvePairOutcome` clears the entry below —
                // this is the one and only place the retained
                // `requesterOrigin` is consumed.
                const requesterOrigin =
                    pairingCorrelations.get(clientId)?.requesterOrigin
                // The first session_request on this connector — whether or
                // not it's a duplicate the guard below drops — is what the
                // caller's `pair()` was waiting to hear about: an approval
                // window is being opened for it either way.
                resolvePairOutcome(clientId, { type: 'session' })
                if (pendingConnectApprovals.has(clientId)) {
                    logger.debug(
                        '[wc-host] session_request dropped: connect approval already pending',
                        { clientId },
                    )
                    return
                }
                pendingConnectApprovals.set(clientId, permissions)
                void deps
                    .requestApproval({
                        kind: 'wc-connect',
                        clientId,
                        chainId,
                        origin: peerOrigin(peerMeta),
                        peerName: peerName(peerMeta),
                        peerIcons: peerIcons(peerMeta),
                        // The same permissions recorded in
                        // `pendingConnectApprovals` above — the surface lists
                        // them so the user sees what they are granting, and
                        // `approveSession` re-reads them from that map rather
                        // than trusting anything that comes back.
                        permissions,
                        requesterOrigin,
                    })
                    .catch((error: unknown) => {
                        // The request never reached an approval window, so
                        // nothing will ever resolve it — clear the guard or
                        // this clientId could never pair again.
                        pendingConnectApprovals.delete(clientId)
                        logger.error('[wc-host] connect approval failed', {
                            clientId,
                            error,
                        })
                    })
            },
            onSignRequest: ({ clientId, wcRequestId, method, payload }) => {
                // `connector` is the exact live session that fired this
                // request, so its `session.peerMeta` is always current —
                // no need to look anything up in a possibly-stale
                // persisted snapshot.
                const liveSession = connector.session as
                    | { peerMeta?: unknown }
                    | undefined
                void deps
                    .requestApproval({
                        kind: 'wc-sign',
                        clientId,
                        wcRequestId,
                        method,
                        payload,
                        origin: peerOrigin(liveSession?.peerMeta),
                    })
                    .catch((error: unknown) => {
                        logger.error('[wc-host] sign approval failed', {
                            clientId,
                            wcRequestId,
                            error,
                        })
                    })
            },
            onDisconnect: clientId => {
                pendingConnectApprovals.delete(clientId)
                // A peer disconnect before any session_request ever fired
                // (e.g. the dApp closes the socket mid-handshake) would
                // otherwise leave this clientId's correlation mapping
                // sitting until its own cleanup timer catches it. No
                // outcome is sent here deliberately — this is a rare edge
                // case outside the four outcomes `pair-outcome` documents,
                // and the caller's own bounded wait (`waitForPairOutcome`)
                // still resolves it as `timeout` on its own; clearing here
                // just cancels the now-redundant timer early.
                clearPairingCorrelation(clientId)
                forgetConnector(clientId)
                deps.removeConnection(clientId)
            },
            onNetworkMismatch: ({ clientId, chainId, peerMeta }) => {
                resolvePairOutcome(clientId, {
                    type: 'error',
                    reason: 'network-mismatch',
                })
                notifyNetworkMismatch({ clientId, chainId, peerMeta })
            },
        })

    // The registry recreates connectors during socket recovery and re-binds
    // handlers through this binder. In offscreen it must be the headless one.
    setConnectorHandlerBinder(bind)

    const adopt = (connector: HeadlessWcConnector): void => {
        bind(connector)
        registerConnector(
            connector.clientId,
            connector as unknown as RegistryConnector,
        )
    }

    // Best-effort cleanup for a connector that got constructed but never
    // made it into the registry. Guarded the way the registry's own
    // `teardownConnector` guards its cleanup: an unguarded throw here would
    // propagate out of `pair`/`reviveStoredSessions` and, for the latter,
    // abort the whole revival loop despite the log claiming it "skips".
    const closeOrphanedConnector = (
        connector: HeadlessWcConnector | undefined,
    ): void => {
        try {
            connector?.transportClose()
        } catch (error) {
            logger.error('[wc-host] orphaned connector cleanup failed', {
                error,
            })
        }
    }

    const pair = (options: {
        uri: string
        // Bundled with `requesterOrigin` for the same reason
        // `armPairingCorrelation` bundles them (see its own comment): two
        // adjacent `string | undefined` params, one caller-chosen and one
        // browser-verified, must not be swappable at a call site.
        correlationId?: string
        requesterOrigin?: string
    }): void => {
        const { uri, correlationId, requesterOrigin } = options
        let connector: HeadlessWcConnector | undefined
        try {
            connector = deps.createConnector({ uri })
            // Unconditional, regardless of whether this pairing itself
            // carries either field below: a `clientId` collision (see
            // `armPairingCorrelation`'s doc comment for why that's expected
            // to be unreachable today, and why that doesn't make this
            // optional) would otherwise leave a PRIOR pairing's entry — its
            // `requesterOrigin` included — sitting in the map for this new
            // pairing's own `session_request` to read back out. That would
            // attribute one pairing's browser-verified requester to a
            // different pairing's peer before the guard below ever runs.
            clearPairingCorrelation(connector.clientId)
            // Record the mapping before `adopt` — a failure inside `adopt`
            // (bind/registerConnector throwing) is still a pair failure the
            // caller needs to hear about, and by then `connector.clientId`
            // is the only handle left to clean the entry up by.
            if (correlationId !== undefined || requesterOrigin !== undefined) {
                armPairingCorrelation(connector.clientId, {
                    correlationId,
                    requesterOrigin,
                })
            }
            adopt(connector)
        } catch (error) {
            if (connector) clearPairingCorrelation(connector.clientId)
            closeOrphanedConnector(connector)
            logger.error('[wc-host] pair failed', { error })
            if (correlationId !== undefined) {
                void deps
                    .sendPairOutcome({
                        correlationId,
                        outcome: {
                            type: 'error',
                            reason: describeError(error),
                        },
                    })
                    .catch(sendError => {
                        logger.warn('[wc-host] pair-outcome delivery failed', {
                            correlationId,
                            error: sendError,
                        })
                    })
            }
        }
    }

    const deliver = async (
        message: Extract<WcControlMessage, { kind: 'deliver' }>,
    ): Promise<void> => {
        try {
            const connector: HeadlessWcConnector = await ensureConnectorReady(
                message.clientId,
                WC_DELIVERY_TIMEOUT_MS,
            )
            if (message.outcome.ok) {
                connector.approveRequest({
                    id: message.wcRequestId,
                    result: message.outcome.result,
                })
            } else {
                connector.rejectRequest({
                    id: message.wcRequestId,
                    error: new Error(message.outcome.message),
                })
            }
        } catch (error) {
            // The dApp times out on its own side exactly as it would have
            // when the response was queued into a dead socket.
            logger.warn('[wc-host] delivery failed', {
                clientId: message.clientId,
                wcRequestId: message.wcRequestId,
                error,
            })
        }
    }

    const reviveStoredSessions = (): void => {
        deps.storedConnections().forEach(connection => {
            if (!connection.clientId) return
            if (getConnector(connection.clientId)) return
            let connector: HeadlessWcConnector | undefined
            try {
                connector = deps.createConnector({
                    session: connection.session,
                })
                adopt(connector)
            } catch (error) {
                closeOrphanedConnector(connector)
                logger.error('[wc-host] revive failed — skipping', {
                    clientId: connection.clientId,
                    error,
                })
            }
        })
    }

    /**
     * Ends an established session by telling the peer, not merely closing
     * the socket. Mirrors `useWalletConnect.disconnect`'s
     * `killSession`-before-drop shape; `off()`s the five listeners first
     * the way the registry's own `teardownConnector` does, then either
     * `killSession`s (which sends `wc_sessionUpdate {approved:false}` and
     * closes the transport itself via `_handleSessionDisconnect` — no
     * double-close) or, if the socket was never connected, closes the
     * transport directly since nothing else will.
     */
    const disconnect = async (clientId: string): Promise<void> => {
        pendingConnectApprovals.delete(clientId)
        clearPairingCorrelation(clientId)
        const connector = getConnector(clientId)
        if (connector) {
            try {
                connector.off('algo_signData')
                connector.off('algo_signTxn')
                connector.off('disconnect')
                connector.off('session_request')
                connector.off('error')
                if (connector.connected) {
                    await connector.killSession({
                        message: 'User disconnected',
                    })
                } else {
                    connector.transportClose()
                }
            } catch (error) {
                logger.warn('[wc-host] disconnect cleanup failed', {
                    clientId,
                    error,
                })
            }
        }
        forgetConnector(clientId)
        deps.removeConnection(clientId)
    }

    /**
     * Completes the connect handshake. Revives a dead socket first — WC v1
     * silently queues into a dead socket, so "connected!" must mean the
     * approval reached an OPEN socket — mirroring `useWalletConnect.
     * approveSession`'s posture: a revival failure here is a real failure,
     * not swallowed inside this function (the dispatcher logs it instead of
     * letting it go unhandled).
     *
     * The control channel has no sender authorization at the transport
     * level narrower than "one of our own extension pages" (see
     * `onWcControlMessage`'s doc comment) — this message's
     * `approvedAddresses` is caller-chosen, so it is intersected with
     * `deps.knownAddresses()` before ever reaching the connector. Only
     * addresses the wallet actually holds are ever handed to
     * `connector.approveSession`. `message.chainId` is what the session is
     * being established AS — it is never used to validate or bypass this
     * check, only forwarded to the connector for the handshake itself.
     *
     * An empty intersection means none of the caller's addresses belong to
     * this wallet — approving with zero accounts would persist a broken
     * session (see `buildApprovedConnection`'s empty-`accounts` case), so
     * this rejects the handshake instead of approving it. Delegating to
     * `rejectSession` also clears `pendingConnectApprovals` for this
     * `clientId`, which — like every other path that concludes a
     * handshake — it must, or this `clientId` could never pair again.
     *
     * Persistence happens only after `approveSession` returns — never
     * before — for the same reason: an unrevived or rejected approval must
     * never be recorded as a live session (see `WcHostDeps.
     * persistConnection`'s doc comment).
     */
    const approveSession = async (
        message: Extract<WcControlMessage, { kind: 'approve-session' }>,
    ): Promise<void> => {
        // Defensive invariant, not the primary gate: `bindHeadlessHandlers`
        // already rejected any wrong-network `session_request` before an
        // approval window was ever opened for it (see its `onNetworkMismatch`
        // branch), so `message.chainId` should already be acceptable by the
        // time this runs. Asserted again here — since the persisted record
        // is the single source of truth for chain acceptability, this is the
        // one place that record gets written, so it's worth refusing to ever
        // write an unacceptable one rather than
        // trusting every upstream caller forever.
        if (!isChainIdAcceptable(message.chainId, deps.network())) {
            logger.error(
                '[wc-host] approve-session rejected: chain id not acceptable on the active network',
                { clientId: message.clientId, chainId: message.chainId },
            )
            await rejectSession({
                scope: WC_CONTROL_SCOPE,
                kind: 'reject-session',
                clientId: message.clientId,
            })
            return
        }
        const permissions = pendingConnectApprovals.get(message.clientId) ?? []
        const knownAddresses = new Set(deps.knownAddresses())
        const approvedAddresses = message.approvedAddresses.filter(address =>
            knownAddresses.has(address),
        )
        if (approvedAddresses.length === 0) {
            logger.error(
                '[wc-host] approve-session rejected: none of the approved addresses belong to this wallet',
                {
                    clientId: message.clientId,
                    approvedAddresses: message.approvedAddresses,
                },
            )
            await rejectSession({
                scope: WC_CONTROL_SCOPE,
                kind: 'reject-session',
                clientId: message.clientId,
            })
            return
        }
        pendingConnectApprovals.delete(message.clientId)
        const connector = await ensureConnectorReady(
            message.clientId,
            WC_DELIVERY_TIMEOUT_MS,
        )
        connector.approveSession({
            chainId: message.chainId,
            accounts: approvedAddresses,
        })
        const existing = deps
            .storedConnections()
            .find(connection => connection.clientId === connector.clientId)
        deps.persistConnection(
            buildApprovedConnection(connector, permissions, existing),
        )
    }

    /**
     * Refuses the connect handshake. Mirrors `useWalletConnect.
     * rejectSession`'s posture: the user explicitly declined, so a revival
     * failure must be swallowed and logged rather than thrown — they must
     * not be trapped behind a dead socket for a decision they already made.
     *
     * `deps.removeConnection` is called explicitly and unconditionally
     * (matching `useWalletConnect.rejectSession`'s own unconditional
     * `setConnections` drop) rather than relying on the SDK's `rejectSession`
     * internally firing its `disconnect` event, which would reach the
     * `onDisconnect` callback bound in `bind()` and remove it there instead.
     * That side effect is real but undocumented — a future change that
     * `off('disconnect')`s before rejecting (as the `disconnect` path above
     * already does) would silently stop removing the record. Safe to call
     * even if that event *does* still fire: `removeConnection`'s store write
     * is a filter, so a second call for the same `clientId` is a no-op.
     */
    const rejectSession = async (
        message: Extract<WcControlMessage, { kind: 'reject-session' }>,
    ): Promise<void> => {
        pendingConnectApprovals.delete(message.clientId)
        try {
            const connector = await ensureConnectorReady(
                message.clientId,
                WC_DELIVERY_TIMEOUT_MS,
            )
            connector.rejectSession()
        } catch (error) {
            logger.warn('[wc-host] reject-session delivery failed', {
                clientId: message.clientId,
                error,
            })
        }
        deps.removeConnection(message.clientId)
    }

    const handleControlMessage = (message: unknown): boolean => {
        if (!isWcControlMessage(message)) return false
        switch (message.kind) {
            case 'pair': {
                pair({
                    uri: message.uri,
                    correlationId: message.correlationId,
                    requesterOrigin: message.requesterOrigin,
                })
                return true
            }
            case 'disconnect': {
                void disconnect(message.clientId)
                return true
            }
            case 'reconnect-all': {
                reconnectAllConnectors()
                return true
            }
            case 'deliver': {
                void deliver(message)
                return true
            }
            case 'approve-session': {
                void approveSession(message).catch((error: unknown) => {
                    logger.error('[wc-host] approve-session failed', {
                        clientId: message.clientId,
                        error,
                    })
                })
                return true
            }
            case 'reject-session': {
                void rejectSession(message)
                return true
            }
        }
    }

    return { handleControlMessage, reviveStoredSessions }
}

export { WC_CONTROL_SCOPE }
