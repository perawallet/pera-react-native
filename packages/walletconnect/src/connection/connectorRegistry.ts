/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import WalletConnect from '@walletconnect/client'
import { logger } from '@perawallet/wallet-core-shared'
import { PERA_CLIENT_META, WC_DELIVERY_TIMEOUT_MS } from '../constants'
import {
    WalletConnectConnectionTimeoutError,
    WalletConnectInvalidSessionError,
} from '../errors'
import { useConnectorRegistryStore } from '../store/connectorRegistryStore'

/**
 * Shared registry of live WalletConnect v1 connectors.
 *
 * Pera RN is on WalletConnect v1, where each session is one `Connector`
 * backed by a single bridge WebSocket. The OS suspends that socket while
 * the app is backgrounded; v1's transport then silently queues any
 * outgoing message into the dead socket — no error, no rejection — so a
 * signed transaction handed back after backgrounding never reaches the
 * dApp even though the UI reports success.
 *
 * Connector + tombstone state lives in
 * {@link useConnectorRegistryStore}. This file owns the side-effectful
 * lifecycle on top — readiness checking, recreation on dead sockets, and
 * the foreground reconnect sweep — plus two transients (in-flight
 * readiness promises and the handler binder) that don't belong in the
 * store.
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
 * Registered by `useWalletConnect`. A recreated connector starts with no
 * dApp request handlers; this re-attaches them so it can still receive
 * `algo_signTxn` etc. after recovery.
 */
let handlerBinder: HandlerBinder | null = null

/**
 * Whether a connector's bridge WebSocket is currently OPEN.
 *
 * WalletConnect v1.8.0 exposes no public socket-state API, and the
 * `transport_open` / `transport_close` events `Connector._initTransport`
 * subscribes to are never emitted — `@walletconnect/socket-transport`'s
 * `SocketTransport` only fires `message` and `error`. The one real-time
 * signal is the connector's private `_transport`: a `SocketTransport`
 * whose public `connected` getter is `readyState === 1`.
 *
 * `@walletconnect/client@1.8.0` is pinned to an exact version, so this
 * internal field is stable.
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

/**
 * Adopt a connector into the registry. Called by
 * `useWalletConnect.connect()` for freshly created connectors and by
 * `recreateConnector` for recovered ones.
 */
export const registerConnector = (
    clientId: string,
    connector: WalletConnect,
): void => {
    useConnectorRegistryStore.getState().registerConnector(clientId, connector)
}

/**
 * Detach every Pera-registered listener from a connector and close its
 * transport, so a superseded connector's dead socket stops its own
 * background reconnect loop instead of leaking.
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
 * Drop a session from the registry entirely (user disconnect). The
 * tombstone makes any `recreateConnector` already in flight for this
 * session abort instead of resurrecting it.
 */
export const forgetConnector = (clientId: string): void => {
    useConnectorRegistryStore.getState().forgetConnector(clientId)
    readinessInFlight.delete(clientId)
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
 * Replace a session's dead connector with a fresh one and wait for its
 * socket to open. A new `Connector` builds a new `SocketTransport` that
 * opens in its constructor — the only reliable way past v1's
 * zombie-`_nextSocket` reconnect deadlock.
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
 * Return a connector for `clientId` whose bridge socket is verified open.
 *
 * Fast path: the connector's socket is already open — resolve it as-is
 * (the common case: connect, then sign). Otherwise the connector is
 * recreated from its stored session and awaited until its fresh socket
 * opens — or a `WalletConnectConnectionTimeoutError` is thrown if it
 * cannot within `timeoutMs`. Concurrent calls for the same session share
 * a single recreation.
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
 * Warm every session whose socket is not currently open. Fire-and-forget:
 * a failed warm-up is not user-facing — the next real delivery attempt
 * surfaces a genuine error if the socket is still down. Used by the
 * app-foreground reconnect hook.
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
