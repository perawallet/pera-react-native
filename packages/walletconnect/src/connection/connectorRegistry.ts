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

import WalletConnect from '@perawallet/walletconnect'
import { logger } from '@perawallet/wallet-core-shared'
import { PERA_CLIENT_META, WC_DELIVERY_TIMEOUT_MS } from '../constants'
import {
    WalletConnectConnectionTimeoutError,
    WalletConnectInvalidSessionError,
} from '../errors'
import { useConnectorRegistryStore } from '../store/connectorRegistryStore'
import { useWalletConnectStore } from '../store'

/**
 * Registry of live WalletConnect v1 connectors, one bridge WebSocket each.
 *
 * The OS suspends that socket while backgrounded, and v1's transport then
 * silently queues outgoing messages into the dead socket — no error, no
 * rejection — so a signed transaction handed back after backgrounding never
 * reaches the dApp while the UI reports success.
 *
 * State lives in {@link useConnectorRegistryStore}; this file owns the
 * side-effectful lifecycle on top — readiness checks, recreation on dead
 * sockets, and the reconnect sweep.
 *
 * The SDK has no ping/heartbeat, so a half-open socket is undetectable until a
 * delivery fails and those sweeps are the only recovery. Revisit at v2.
 */

/** Re-binds dApp request handlers (`algo_signTxn`, …) onto a connector. */
type HandlerBinder = (connector: WalletConnect) => void

/** Poll cadence while waiting for a recreated socket to report open. */
const POLL_INTERVAL_MS = 50

// Transient runtime artifacts: not state (no React consumers, never
// observed), so kept at module scope to avoid polluting the store.

/** De-dupes concurrent readiness requests for the same session. */
const readinessInFlight = new Map<string, Promise<WalletConnect>>()

/**
 * A recreated connector starts with no request handlers, so this re-attaches
 * them and it can still receive `algo_signTxn` after recovery.
 */
let handlerBinder: HandlerBinder | null = null

/**
 * v1 exposes no public socket-state API, and the `transport_open`/`_close`
 * events it subscribes to are never emitted — the bundled transport only fires
 * `message` and `error`. The one real signal is the private `_transport`, whose
 * `connected` getter is `readyState === 1`. Safe to reach for: the package is
 * pinned to an exact version.
 */
const isSocketOpen = (connector: WalletConnect): boolean =>
    Boolean(
        (connector as unknown as { _transport?: { connected?: boolean } })
            ._transport?.connected,
    )

/**
 * Register how dApp request handlers get (re)bound onto a connector.
 * `useWalletConnect` calls this once on mount.
 */
export const setConnectorHandlerBinder = (binder: HandlerBinder): void => {
    handlerBinder = binder
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
 * Stops a superseded connector's dead socket running its own background
 * reconnect loop instead of leaking.
 */
const teardownConnector = (connector: WalletConnect): void => {
    try {
        connector.off('algo_signData')
        connector.off('algo_signTxn')
        connector.off('disconnect')
        connector.off('session_request')
        connector.off('error')
        connector.transportClose()
    } catch {
        // Teardown of a superseded connector is best-effort; a failure
        // here is non-fatal and intentionally swallowed.
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
 * Deterministically kills a pairing that never produced a session. A timed-out
 * pairing's connector keeps its `session_request` handler bound for the full
 * request TTL, so a slow dApp response can pop a "ghost" approval sheet
 * minutes after the user was told pairing failed — unbinding the handlers and
 * closing the transport is the only way to prevent that (`forgetConnector`
 * alone leaves them bound). Refuses to touch a connector that connected or
 * has a persisted session: abandonment is strictly for failed pairings.
 */
export const abandonPairing = (clientId: string): void => {
    const connector = useConnectorRegistryStore.getState().connectors[clientId]
    if (!connector) return
    if (connector.connected) return
    const hasStoredConnection = useWalletConnectStore
        .getState()
        .walletConnectConnections.some(
            connection => connection.clientId === clientId,
        )
    if (hasStoredConnection) return
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

    const fresh = new WalletConnect({ session, clientMeta: PERA_CLIENT_META })
    registerConnector(clientId, fresh)

    if (handlerBinder) {
        handlerBinder(fresh)
    } else {
        logger.error(
            'WC recreateConnector: no handler binder registered — the recreated connector is deaf to dApp requests',
            { clientId },
        )
    }

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
 * A connector whose socket is verified open: resolved as-is in the common
 * connect-then-sign case, otherwise recreated from the stored session and
 * awaited (or timed out). Concurrent calls share one recreation.
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
            // Swallowed — see the fire-and-forget note above.
        })
    }
}

/** Test-only: clears all registry state between tests. */
export const __resetRegistryForTests = (): void => {
    useConnectorRegistryStore.getState().resetState()
    readinessInFlight.clear()
    handlerBinder = null
}
