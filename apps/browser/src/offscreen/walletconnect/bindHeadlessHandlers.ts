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
    ALL_PERMISSIONS,
    gateSignDataRequest,
    gateSignTxnRequest,
    isChainIdAcceptable,
} from '@perawallet/wallet-core-walletconnect'

/**
 * The slice of the real WC v1 `WalletConnect` client (`@perawallet/walletconnect`)
 * this binder — and the offscreen host built on top of it (`wcHost.ts`) —
 * depend on. Defined locally rather than importing the class type directly:
 * that package is only a dependency of `packages/walletconnect`, not of
 * `apps/mobile`, so it isn't resolvable at the type level from this file. A
 * real `WalletConnect` instance (and the test doubles in
 * `__tests__/bindHeadlessHandlers.test.ts` / `__tests__/wcHost.test.ts`)
 * satisfies this structurally.
 *
 * Beyond the five listener-binding members below, `wcHost.ts` also needs:
 *   - `approveSession` / `rejectSession` — complete or refuse the v1
 *     handshake (`session_request`), mirroring
 *     `useWalletConnect.approveSession` / `.rejectSession`.
 *   - `approveRequest` / `rejectRequest` — deliver a signed/declined result
 *     back to the dApp once the service worker's response comes back.
 *   - `connected` / `killSession` — end an established session by telling
 *     the peer (`wc_sessionUpdate {approved:false}`) instead of merely
 *     closing the socket, mirroring `useWalletConnect.disconnect`.
 *   - `transportClose` — best-effort socket cleanup when adopting a
 *     freshly created connector fails partway through (pair/revive), or
 *     when disconnecting a session that was never connected.
 *   - `session` — the host reads the live connector's peer metadata for
 *     approval-request origin instead of relying on a possibly-stale
 *     persisted snapshot.
 *   - `version` / `bridge` — persisted onto the `WalletConnectConnection`
 *     record once a handshake is approved, mirroring the fields
 *     `useWalletConnect.approveSession` copies off the connector (never
 *     the connector itself — see `wcHost.ts`'s `buildApprovedConnection`).
 */
export type HeadlessWcConnector = {
    readonly clientId: string
    readonly chainId: number
    readonly connected: boolean
    readonly session: unknown
    readonly version: number
    readonly bridge: string
    on: (
        event: string,
        callback: (error: Error | null, payload?: unknown) => void,
    ) => void
    off: (event: string) => void
    approveSession: (sessionStatus: {
        chainId: number
        accounts: string[]
    }) => void
    rejectSession: (sessionError?: { message?: string }) => void
    killSession: (sessionError?: { message?: string }) => Promise<void>
    rejectRequest: (response: {
        id?: number
        error?: { message: string }
    }) => void
    approveRequest: (response: { id?: number; result?: unknown }) => void
    transportClose: () => void
}

export type HeadlessHandlerDeps = {
    network: () => Network
    knownAddresses: () => readonly string[]
    /**
     * Looks up the network a `clientId`'s session was actually approved
     * for, from the *persisted* `WalletConnectConnection` record — never
     * from the live connector's `chainId` field. Mirrors mobile's
     * `validateRequest` (`useWalletConnectHandlers.ts`), which reads
     * `foundConnection.session.chainId` off the store rather than
     * `connector.chainId`.
     *
     * That distinction is load-bearing: WC v1's `_handleSessionResponse`
     * applies an inbound `wc_sessionUpdate` to `this.chainId` with no
     * authorization check, and the dApp peer holds the session key needed
     * to publish one on the wallet's own topic. A dApp can therefore set
     * the live connector's `chainId` to `4160` (`AlgorandChainId.all`, the
     * wildcard) post-handshake, which would make `isChainIdAcceptable`
     * accept every network if this gate ever read it. The persisted record
     * is never rewritten by that message, so it stays the ground truth.
     *
     * Returns `undefined` when there is no persisted record for `clientId`
     * (pre-handshake, or a revoked/unknown session) — `isChainIdAcceptable`
     * already rejects `undefined`, so a sign request arriving before any
     * session was ever approved is rejected exactly as before.
     */
    sessionChainId: (clientId: string) => number | undefined
    onSessionRequest: (input: {
        clientId: string
        chainId: number
        permissions: string[]
        peerMeta: unknown
    }) => void
    onSignRequest: (input: {
        clientId: string
        wcRequestId: number
        method: 'algo_signTxn' | 'algo_signData'
        payload: unknown
    }) => void
    onDisconnect: (clientId: string) => void
    /**
     * Fired when a `session_request` is auto-rejected for targeting the
     * wrong network — the one handshake-rejection path this binder decides
     * on its own rather than forwarding to `onSessionRequest` for the
     * approval surface to judge. `wcHost.ts` uses this to resolve a `pair`
     * call's `pair-outcome` as `'error'`: this handler knows
     * `connector.clientId` but not the caller's `correlationId`, so the
     * host — which recorded that mapping at pair time — is the one that
     * can act on it.
     *
     * Carries the rejected request's `chainId` and `peerMeta` too, because
     * the host also raises a user-facing notification surface for this case
     * (a page-initiated pair has no outcome channel back to the page, so
     * without one the user's click silently does nothing) and that surface
     * names both sides of the mismatch.
     */
    onNetworkMismatch: (input: {
        clientId: string
        chainId?: number
        peerMeta: unknown
    }) => void
}

const readRequestId = (payload: unknown): number | undefined => {
    if (typeof payload !== 'object' || payload === null) return undefined
    const { id } = payload as { id?: unknown }
    return typeof id === 'number' ? id : undefined
}

/**
 * Binds Pera's five WC v1 listeners onto `connector` without any React.
 * Mirrors `useWalletConnect.bindRequestHandlers`'s event set and its
 * `off`-first idempotency, but routes through `deps` so the offscreen host
 * can forward to the service worker instead of an in-process sheet queue.
 *
 * Mobile keeps using the React binder; this exists because offscreen has no
 * React tree and must not grow one.
 */
export const bindHeadlessHandlers = (
    connector: HeadlessWcConnector,
    deps: HeadlessHandlerDeps,
): void => {
    connector.off('algo_signData')
    connector.off('algo_signTxn')
    connector.off('disconnect')
    connector.off('session_request')
    connector.off('error')

    connector.on('session_request', (error, payload) => {
        if (error) {
            logger.error('[wc-host] session_request error', { error })
            return
        }
        const params = (payload as { params?: unknown[] } | undefined)
            ?.params?.[0] as
            | {
                  peerMeta?: unknown
                  chainId?: number
                  permissions?: string[]
              }
            | undefined
        if (!params) return

        if (!isChainIdAcceptable(params.chainId, deps.network())) {
            // warn, not debug: this refuses a pairing the user explicitly
            // asked for, and it is the only handshake path that answers the
            // peer without any surface ever opening. The dApp's own SDK
            // reacts to the rejection by tearing its connect modal down, so
            // from the user's side the click simply does nothing. At debug
            // level (below the default INFO threshold in packaged builds,
            // see Logger's `level` in packages/shared/src/utils/logging.ts)
            // that left no trace anywhere to diagnose it from.
            logger.warn('[wc-host] session_request rejected: wrong network', {
                clientId: connector.clientId,
                chainId: params.chainId,
                network: deps.network(),
            })
            connector.rejectSession()
            deps.onNetworkMismatch({
                clientId: connector.clientId,
                chainId: params.chainId,
                peerMeta: params.peerMeta,
            })
            return
        }

        deps.onSessionRequest({
            clientId: connector.clientId,
            chainId: params.chainId as number,
            permissions: params.permissions ?? [...ALL_PERMISSIONS],
            peerMeta: params.peerMeta,
        })
    })

    connector.on('algo_signTxn', (error, payload) => {
        if (error) {
            logger.error('[wc-host] algo_signTxn error', { error })
            return
        }
        const verdict = gateSignTxnRequest({
            payload,
            network: deps.network(),
            sessionChainId: deps.sessionChainId(connector.clientId),
            knownAddresses: deps.knownAddresses(),
        })
        if (!verdict.ok) {
            const id = readRequestId(payload)
            if (id === undefined) {
                logger.debug(
                    '[wc-host] algo_signTxn dropped: no request id to answer',
                    { clientId: connector.clientId, reason: verdict.reason },
                )
                return
            }
            logger.debug('[wc-host] algo_signTxn rejected by gate', {
                clientId: connector.clientId,
                reason: verdict.reason,
            })
            connector.rejectRequest({ id, error: new Error(verdict.reason) })
            return
        }
        deps.onSignRequest({
            clientId: connector.clientId,
            wcRequestId: readRequestId(payload) as number,
            method: 'algo_signTxn',
            payload,
        })
    })

    connector.on('algo_signData', (error, payload) => {
        if (error) {
            logger.error('[wc-host] algo_signData error', { error })
            return
        }
        const verdict = gateSignDataRequest({
            payload,
            network: deps.network(),
            sessionChainId: deps.sessionChainId(connector.clientId),
        })
        if (!verdict.ok) {
            const id = readRequestId(payload)
            if (id === undefined) {
                logger.debug(
                    '[wc-host] algo_signData dropped: no request id to answer',
                    { clientId: connector.clientId, reason: verdict.reason },
                )
                return
            }
            logger.debug('[wc-host] algo_signData rejected by gate', {
                clientId: connector.clientId,
                reason: verdict.reason,
            })
            connector.rejectRequest({ id, error: new Error(verdict.reason) })
            return
        }
        deps.onSignRequest({
            clientId: connector.clientId,
            wcRequestId: readRequestId(payload) as number,
            method: 'algo_signData',
            payload,
        })
    })

    connector.on('disconnect', () => {
        deps.onDisconnect(connector.clientId)
    })

    connector.on('error', error => {
        if (error) logger.error('[wc-host] connector error', { error })
    })
}
