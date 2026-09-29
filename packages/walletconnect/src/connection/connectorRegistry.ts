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

import type WalletConnect from '@perawallet/walletconnect'
import { WC_DELIVERY_TIMEOUT_MS } from '../shared/constants'
import {
    WalletConnectConnectionTimeoutError,
    WalletConnectInvalidSessionError,
} from '../shared/errors'
import { createWalletConnectConnector } from './createConnector'

/**
 * Live v1 connectors, one bridge WebSocket each. The OS suspends that socket
 * while backgrounded and v1 silently queues outgoing messages into it, so a
 * post-background delivery "succeeds" without reaching the dApp. The SDK has
 * no heartbeat, so a half-open socket is undetectable until a delivery fails.
 */
export type WalletConnectConnectorRegistry = {
    get(clientId: string): WalletConnect | undefined
    /** Called for both freshly created and recovered connectors. */
    register(clientId: string, connector: WalletConnect): void
    /**
     * User disconnect. The tombstone aborts any in-flight recreation instead
     * of letting it resurrect the session.
     */
    forget(clientId: string): void
    /**
     * A timed-out pairing keeps `session_request` bound for the full request
     * TTL, so a slow dApp can pop a ghost approval sheet minutes later.
     * `connected` flips inside `approveSession` and alone says whether a
     * session exists; reading the legacy store here would re-persist the
     * plaintext keys the importer just deleted.
     */
    abandonPairing(clientId: string): void
    /**
     * Resolved as-is when the socket is open, otherwise recreated from the
     * stored session. Concurrent calls share one recreation.
     */
    ensureReady(clientId: string, timeoutMs?: number): Promise<WalletConnect>
    /**
     * Fire-and-forget: a failed warm-up isn't user-facing, since the next real
     * delivery surfaces a genuine error if the socket is still down.
     */
    reconnectAll(timeoutMs?: number): void
}

export type CreateConnectorRegistryOptions = {
    /** Re-binds dApp request handlers onto a recreated connector, which starts with none. */
    bindHandlers: (connector: WalletConnect) => void
}

/** The connector events the v1 handler binds; teardown unbinds exactly these. */
export const BOUND_EVENTS = [
    'session_request',
    'algo_signTxn',
    'algo_signData',
    'disconnect',
    'error',
    'transport_error',
] as const

/** Poll cadence while waiting for a recreated socket to report open. */
const POLL_INTERVAL_MS = 50

/**
 * v1 exposes no socket-state API and never emits `transport_open`/`_close`; the
 * private `_transport.connected` (`readyState === 1`) is the one real signal.
 * Safe to reach for because the package is pinned to an exact version.
 */
const isSocketOpen = (connector: WalletConnect): boolean =>
    Boolean(
        (connector as unknown as { _transport?: { connected?: boolean } })
            ._transport?.connected,
    )

/**
 * Unbinds and closes a connector so a dead or superseded socket cannot run its
 * own reconnect loop or fire a late `session_request`. Best-effort: the
 * connector is being discarded, so a failure here has nothing left to break.
 */
export const teardownConnector = (connector: WalletConnect): void => {
    try {
        for (const event of BOUND_EVENTS) connector.off(event)
        connector.transportClose()
    } catch {
        // Discarding the connector anyway.
    }
}

/** Resolves once `connector`'s socket reports open, or rejects on timeout. */
const waitForSocketOpen = (
    connector: WalletConnect,
    timeoutMs: number,
): Promise<void> =>
    new Promise((resolve, reject) => {
        const startedAt = Date.now()
        const poll = (): void => {
            if (isSocketOpen(connector)) {
                resolve()
                return
            }
            if (Date.now() - startedAt >= timeoutMs) {
                reject(new WalletConnectConnectionTimeoutError())
                return
            }
            setTimeout(poll, POLL_INTERVAL_MS)
        }
        poll()
    })

/**
 * One per v1 handler instance, never shared: each socket is bound to its
 * handler's closures, and in the extension only the offscreen document's
 * handler may hold live ones.
 */
export const createConnectorRegistry = ({
    bindHandlers,
}: CreateConnectorRegistryOptions): WalletConnectConnectorRegistry => {
    const connectors = new Map<string, WalletConnect>()
    const tombstones = new Set<string>()
    const readinessInFlight = new Map<string, Promise<WalletConnect>>()

    const register = (clientId: string, connector: WalletConnect): void => {
        tombstones.delete(clientId)
        connectors.set(clientId, connector)
    }

    const forget = (clientId: string): void => {
        connectors.delete(clientId)
        tombstones.add(clientId)
        readinessInFlight.delete(clientId)
    }

    /**
     * A new `Connector` builds a transport that opens in its constructor — the
     * only reliable way past v1's zombie-`_nextSocket` reconnect deadlock.
     */
    const recreate = async (
        clientId: string,
        staleConnector: WalletConnect,
        timeoutMs: number,
    ): Promise<WalletConnect> => {
        const session = staleConnector.session
        if (!session?.peerId) {
            throw new WalletConnectInvalidSessionError(
                `WalletConnect session ${clientId} has no peer to deliver to`,
            )
        }

        teardownConnector(staleConnector)

        const fresh = createWalletConnectConnector({ session })
        register(clientId, fresh)
        bindHandlers(fresh)

        await waitForSocketOpen(fresh, timeoutMs)

        // The user may have disconnected the session while we waited.
        if (tombstones.has(clientId)) {
            teardownConnector(fresh)
            throw new WalletConnectInvalidSessionError(
                `WalletConnect session ${clientId} was disconnected during reconnect`,
            )
        }

        return fresh
    }

    const ensureReady = (
        clientId: string,
        timeoutMs: number = WC_DELIVERY_TIMEOUT_MS,
    ): Promise<WalletConnect> => {
        const inFlight = readinessInFlight.get(clientId)
        if (inFlight) {
            return inFlight
        }

        const existing = connectors.get(clientId)
        if (!existing) {
            return Promise.reject(
                new WalletConnectInvalidSessionError(
                    `No WalletConnect connector for client ${clientId}`,
                ),
            )
        }

        if (isSocketOpen(existing)) {
            return Promise.resolve(existing)
        }

        const tracked: Promise<WalletConnect> = recreate(
            clientId,
            existing,
            timeoutMs,
        ).finally(() => {
            if (readinessInFlight.get(clientId) === tracked) {
                readinessInFlight.delete(clientId)
            }
        })
        readinessInFlight.set(clientId, tracked)
        return tracked
    }

    return {
        get: clientId => connectors.get(clientId),
        register,
        forget,
        abandonPairing: clientId => {
            const connector = connectors.get(clientId)
            if (!connector) return
            if (connector.connected) return
            teardownConnector(connector)
            forget(clientId)
        },
        ensureReady,
        reconnectAll: (timeoutMs = WC_DELIVERY_TIMEOUT_MS) => {
            // Snapshotted: a recreation re-registers into the map mid-loop.
            for (const [clientId, connector] of [...connectors]) {
                if (isSocketOpen(connector)) {
                    continue
                }
                void ensureReady(clientId, timeoutMs).catch(() => {
                    // Fire-and-forget; see the type.
                })
            }
        },
    }
}
