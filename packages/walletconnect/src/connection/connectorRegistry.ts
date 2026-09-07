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
import { logger } from '@perawallet/wallet-core-shared'
import { WC_DELIVERY_TIMEOUT_MS } from '../shared/constants'
import {
    WalletConnectConnectionTimeoutError,
    WalletConnectInvalidSessionError,
} from '../shared/errors'
import { useConnectorRegistryStore } from '../store/connectorRegistryStore'
import { createWalletConnectConnector } from './createConnector'

/**
 * Live v1 connectors, one bridge WebSocket each. The OS suspends that socket
 * while backgrounded and v1 silently queues outgoing messages into it, so a
 * post-background delivery "succeeds" without reaching the dApp. The SDK has
 * no heartbeat, so a half-open socket is undetectable until a delivery fails.
 */

/** Re-binds dApp request handlers (`algo_signTxn`, …) onto a connector. */
type HandlerBinder = (connector: WalletConnect) => void

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

// Not store state: nothing renders off these.

/** De-dupes concurrent readiness requests for the same session. */
const readinessInFlight = new Map<string, Promise<WalletConnect>>()

/**
 * A recreated connector starts with no request handlers. The binder's owner must
 * outlive every connector: a binder from an unmounted React instance keeps
 * working but frozen on the render state it last saw (accounts, network).
 */
let handlerBinder: HandlerBinder | null = null

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
 * Register how dApp request handlers get (re)bound onto a connector. Reserved
 * for a single long-lived owner per realm: the v1 handler's `initialize` on
 * native, the offscreen host on web.
 */
export const setConnectorHandlerBinder = (binder: HandlerBinder): void => {
    handlerBinder = binder
}

/** No-op unless `binder` is still the registered one: a departing owner must never clear its successor. */
export const clearConnectorHandlerBinder = (binder: HandlerBinder): void => {
    if (handlerBinder === binder) {
        handlerBinder = null
    }
}

/**
 * `fallback` is used only before an owner has registered; it accepts the freeze
 * risk described on `handlerBinder`, since nothing re-binds the connector later.
 */
export const bindConnectorHandlers = (
    connector: WalletConnect,
    fallback?: HandlerBinder,
): void => {
    if (handlerBinder) {
        handlerBinder(connector)
        return
    }
    if (fallback) {
        logger.warn(
            'WC bindConnectorHandlers: no handler binder registered — binding through the calling instance, whose handlers freeze if it unmounts',
            { clientId: connector.clientId },
        )
        fallback(connector)
        return
    }
    logger.error(
        'WC bindConnectorHandlers: no handler binder registered — the connector is deaf to dApp requests',
        { clientId: connector.clientId },
    )
}

/** The current connector for a session, if the registry has one. */
export const getConnector = (clientId: string): WalletConnect | undefined =>
    useConnectorRegistryStore.getState().connectors[clientId]

/** Called for both freshly created and recovered connectors. */
export const registerConnector = (
    clientId: string,
    connector: WalletConnect,
): void => {
    useConnectorRegistryStore.getState().registerConnector(clientId, connector)
}

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

/**
 * User disconnect. The tombstone aborts any in-flight `recreateConnector`
 * instead of letting it resurrect the session.
 */
export const forgetConnector = (clientId: string): void => {
    useConnectorRegistryStore.getState().forgetConnector(clientId)
    readinessInFlight.delete(clientId)
}

/**
 * A timed-out pairing keeps `session_request` bound for the full request TTL, so
 * a slow dApp can pop a ghost approval sheet minutes later. `connected` flips
 * inside `approveSession` and alone says whether a session exists; reading the
 * legacy store here would re-persist the plaintext keys the importer just deleted.
 */
export const abandonPairing = (clientId: string): void => {
    const connector = useConnectorRegistryStore.getState().connectors[clientId]
    if (!connector) return
    if (connector.connected) return
    teardownConnector(connector)
    forgetConnector(clientId)
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
 * Never rejects and never touches the connector; the caller decides whether a
 * dead pairing socket means abandoning. A pairing connector has no `peerId`
 * yet, so recreation is impossible and watching is all there is.
 */
export const waitForPairingSocketOpen = (
    clientId: string,
    timeoutMs: number,
): Promise<boolean> =>
    new Promise(resolve => {
        const startedAt = Date.now()
        const poll = (): void => {
            const connector =
                useConnectorRegistryStore.getState().connectors[clientId]
            if (connector && isSocketOpen(connector)) {
                resolve(true)
                return
            }
            if (Date.now() - startedAt >= timeoutMs) {
                resolve(false)
                return
            }
            setTimeout(poll, POLL_INTERVAL_MS)
        }
        poll()
    })

/**
 * A new `Connector` builds a transport that opens in its constructor — the only
 * reliable way past v1's zombie-`_nextSocket` reconnect deadlock.
 */
const recreateConnector = async (
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
    registerConnector(clientId, fresh)

    bindConnectorHandlers(fresh)

    await waitForSocketOpen(fresh, timeoutMs)

    // The user may have disconnected the session while we waited.
    if (useConnectorRegistryStore.getState().tombstones.has(clientId)) {
        teardownConnector(fresh)
        throw new WalletConnectInvalidSessionError(
            `WalletConnect session ${clientId} was disconnected during reconnect`,
        )
    }

    return fresh
}

/**
 * Resolved as-is when the socket is open, otherwise recreated from the stored
 * session. Concurrent calls share one recreation.
 */
export const ensureConnectorReady = (
    clientId: string,
    timeoutMs: number = WC_DELIVERY_TIMEOUT_MS,
): Promise<WalletConnect> => {
    const inFlight = readinessInFlight.get(clientId)
    if (inFlight) {
        return inFlight
    }

    const existing = useConnectorRegistryStore.getState().connectors[clientId]
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

    const tracked: Promise<WalletConnect> = recreateConnector(
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

/**
 * Fire-and-forget: a failed warm-up isn't user-facing, since the next real
 * delivery surfaces a genuine error if the socket is still down.
 */
export const reconnectAllConnectors = (
    timeoutMs: number = WC_DELIVERY_TIMEOUT_MS,
): void => {
    const connectors = useConnectorRegistryStore.getState().connectors
    for (const [clientId, connector] of Object.entries(connectors)) {
        if (isSocketOpen(connector)) {
            continue
        }
        void ensureConnectorReady(clientId, timeoutMs).catch(() => {
            // Fire-and-forget; see above.
        })
    }
}

/** Test-only: clears all registry state between tests. */
export const __resetRegistryForTests = (): void => {
    useConnectorRegistryStore.getState().resetState()
    readinessInFlight.clear()
    handlerBinder = null
}
