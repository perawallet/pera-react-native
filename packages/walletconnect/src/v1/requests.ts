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
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import {
    logger,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { WalletOperationType } from '@perawallet/wallet-core-connections'
import {
    connectionScope,
    type HandlerKit,
} from '@perawallet/wallet-core-connections/handlerKit'
import type { WalletConnectConnectorRegistry } from '../connection'
import { WC_DELIVERY_TIMEOUT_MS } from '../shared/constants'
import {
    isV1ChainIdAcceptable,
    walletConnectSupportFor,
} from '../shared/chainSupport'
import {
    emptySignaturesResult,
    GET_EMPTY_SIGNATURES_METHOD,
} from '../shared/emptySignatures'
import {
    WalletConnectInvalidNetworkError,
    WalletConnectInvalidSessionError,
    WalletConnectSignRequestError,
} from '../shared/errors'
import {
    gateSignDataRequest,
    gateSignTxnRequest,
    type GateRejectionCode,
    type GateResult,
} from '../validation/inboundRequestGate'
import type { WalletConnectV1AnsweredRequests } from './answeredRequests'
import {
    isWalletConnectV1Connection,
    type WalletConnectV1Connection,
} from './connection'
import {
    asWcRequest,
    legacyItemChainIdsAcceptable,
    type WcRequest,
} from './wire'

/** A connector event listener's body; the binder owns catching its rejection. */
export type V1ConnectorEventHandler = (
    connector: WalletConnect,
    error: Nullable<Error>,
    payload: unknown,
) => Promise<void>

export type V1RequestHandlers = {
    connectionFor: (
        clientId: string,
    ) => Promise<Nullable<WalletConnectV1Connection>>
    handleSignTxn: V1ConnectorEventHandler
    handleSignData: V1ConnectorEventHandler
    handleGetEmptySignatures: V1ConnectorEventHandler
}

type ReplayKind = 'answered' | 'in-flight'

// Pera Connect ids are `Date.now() * 1000` plus a 3-digit random suffix. An id
// outside this window carries no send time.
const MIN_TIMESTAMPED_ID = 1e15
const MAX_TIMESTAMPED_ID = 1e16

const requestAgeMs = (requestId: number): number | undefined =>
    requestId >= MIN_TIMESTAMPED_ID && requestId < MAX_TIMESTAMPED_ID
        ? Date.now() - Math.floor(requestId / 1000)
        : undefined

export const createV1RequestHandlers = (deps: {
    kit: HandlerKit
    connectors: Pick<WalletConnectConnectorRegistry, 'ensureReady'>
    getNetwork: () => Network
    answeredRequests: WalletConnectV1AnsweredRequests
}): V1RequestHandlers => {
    const { kit, connectors, getNetwork, answeredRequests } = deps
    const { reportError, store, recordActivity, requireContext } = kit

    // Requests surfaced and not yet answered. Memory only: one lost to an app
    // kill mid-review must come back on the next launch.
    const inFlight = new Set<string>()
    const requestKey = (clientId: string, requestId: number): string =>
        `${clientId}\u0000${requestId}`

    const markAnswered = (clientId: string, requestId: number): void => {
        inFlight.delete(requestKey(clientId, requestId))
        answeredRequests.record(clientId, requestId)
    }

    // An answer that never reached the dApp leaves it waiting, so a
    // redelivery of that id is the dApp's only way to be answered.
    const releaseClaim = (clientId: string, requestId: number): void => {
        inFlight.delete(requestKey(clientId, requestId))
    }

    const replayOf = (
        clientId: string,
        requestId: number,
    ): Nullable<ReplayKind> => {
        if (inFlight.has(requestKey(clientId, requestId))) return 'in-flight'
        // Only a send-time id is unique for the life of a session; a dApp
        // counting ids from 1 would otherwise have its next request dropped.
        if (requestAgeMs(requestId) === undefined) return null
        return answeredRequests.has(clientId, requestId) ? 'answered' : null
    }

    /**
     * Claims a request for this intake, or drops it as a repeat. Never answers
     * a repeat: the dApp has settled (or is still awaiting) that id, and a
     * second answer to it is at best ignored.
     */
    const claimRequest = (
        clientId: string,
        requestId: number,
        method: string,
    ): boolean => {
        const ageMs = requestAgeMs(requestId)
        const replay = replayOf(clientId, requestId)
        if (replay) {
            const context = {
                clientId,
                requestId,
                method,
                replayOf: replay,
                ageMs,
            }
            if (replay === 'answered') {
                // Error level so field occurrences reach crash reporting: the
                // only trace of a bridge replay once it stops reaching the UI.
                logger.error('[WC v1] dropped a replayed sign request', context)
            } else {
                logger.warn('[WC v1] dropped a duplicate sign request', context)
            }
            return false
        }
        logger.info('[WC v1] sign request received', {
            clientId,
            requestId,
            method,
            ageMs,
        })
        inFlight.add(requestKey(clientId, requestId))
        return true
    }

    const connectionFor = async (
        clientId: string,
    ): Promise<Nullable<WalletConnectV1Connection>> => {
        const record = await store().get(clientId)
        if (!record) return null
        return isWalletConnectV1Connection(record) ? record : null
    }

    // Fire-and-forget: never throws back into a socket listener. A failed
    // revival leaves the dApp timing out, as a send into a dead socket would.
    const rejectToPeer = (
        clientId: string,
        requestId: number,
        error: Error,
    ): void => {
        void connectors
            .ensureReady(clientId, WC_DELIVERY_TIMEOUT_MS)
            .then(connector => {
                connector.rejectRequest({ id: requestId, error })
                markAnswered(clientId, requestId)
            })
            .catch((deliveryError: unknown) => {
                releaseClaim(clientId, requestId)
                logger.warn('[WC v1] reject delivery failed', {
                    clientId,
                    requestId,
                    error: deliveryError,
                })
            })
    }

    const emitRequest = (input: {
        connection: WalletConnectV1Connection
        requestId: number
        type: WalletOperationType
        params: unknown
    }): void => {
        const { connection, requestId } = input
        // Without this the settings list, which sorts on `lastActiveAt`, stays
        // in approval order for the life of the connection.
        recordActivity(connection.id)

        // A backgrounded v1 socket swallows sends silently, so delivery goes
        // through a socket verified open; a failed revival rejects so the
        // signing pipeline knows to retry instead of reporting a fake success.
        const deliver = async (
            send: (connector: WalletConnect) => void,
        ): Promise<void> => {
            const connector = await connectors.ensureReady(
                connection.id,
                WC_DELIVERY_TIMEOUT_MS,
            )
            send(connector)
            markAnswered(connection.id, requestId)
        }

        // The gate already required a registered adapter for this network.
        const support = walletConnectSupportFor(getNetwork())
        if (!support) {
            const unsupported = new WalletConnectInvalidNetworkError()
            rejectToPeer(connection.id, requestId, unsupported)
            reportError(unsupported, connectionScope(connection.id))
            return
        }

        requireContext().onMessage({
            kind: 'request',
            chainId: scopeForLegacyNetwork(getNetwork()).chainId,
            connectionId: connection.id,
            correlationId: String(requestId),
            sourceType: 'walletconnect',
            authorizedAccounts: connection.accounts,
            // The approval-time snapshot, not the live `peerMeta` a dApp can overwrite afterwards.
            peer: connection.peer,
            verifiedOrigin: connection.origin?.requesterOrigin,
            rawOperation: { type: input.type, params: input.params },
            respond: result =>
                deliver(connector =>
                    connector.approveRequest({
                        id: requestId,
                        result: support.toWireResult(result),
                    }),
                ),
            // A failed `respond` keeps its claim: the request stays queued for
            // RETRY. A failed `reject` is the request's last answer.
            reject: error =>
                deliver(connector =>
                    connector.rejectRequest({ id: requestId, error }),
                ).catch((deliveryError: unknown) => {
                    releaseClaim(connection.id, requestId)
                    throw deliveryError
                }),
        })
    }

    const openRequest = async (
        connector: WalletConnect,
        method: string,
        error: Nullable<Error>,
        payload: unknown,
    ): Promise<
        Nullable<{
            request: WcRequest
            connection: WalletConnectV1Connection
        }>
    > => {
        const clientId = connector.clientId
        const request = asWcRequest(payload)

        if (error) {
            const wrapped = new WalletConnectSignRequestError(
                `An error occurred while handling a WalletConnect ${method} request.`,
                error,
            )
            if (request) rejectToPeer(clientId, request.id, wrapped)
            reportError(wrapped, connectionScope(clientId))
            return null
        }
        if (!request) {
            // No id, no way to address a response.
            reportError(
                new WalletConnectSignRequestError(
                    `Dropped a ${method} frame with no request id`,
                ),
                connectionScope(clientId),
            )
            return null
        }

        const connection = await connectionFor(clientId)
        if (!connection) {
            const notFound = new WalletConnectInvalidSessionError(
                'No session found',
            )
            rejectToPeer(clientId, request.id, notFound)
            reportError(notFound, connectionScope(clientId))
            return null
        }

        return { request, connection }
    }

    // The gate's `reason` is developer English that reaches the peer; the code
    // is what picks the class, and with it the copy the user is shown.
    const rejectionFor = (reason: string, code: GateRejectionCode): Error => {
        if (code === 'invalid-network')
            return new WalletConnectInvalidNetworkError(reason)
        if (code === 'session-not-found')
            return new WalletConnectInvalidSessionError(reason)
        return new WalletConnectSignRequestError(reason)
    }

    const declineRequest = (
        clientId: string,
        requestId: number,
        verdict: Extract<GateResult, { ok: false }>,
    ): void => {
        const rejection = rejectionFor(verdict.reason, verdict.code)
        rejectToPeer(clientId, requestId, rejection)
        reportError(rejection, connectionScope(clientId))
    }

    const handleSignTxn: V1ConnectorEventHandler = async (
        connector,
        error,
        payload,
    ) => {
        const opened = await openRequest(
            connector,
            'algo_signTxn',
            error,
            payload,
        )
        if (!opened) return
        const { request, connection } = opened
        if (!claimRequest(connection.id, request.id, 'algo_signTxn')) return

        const verdict = gateSignTxnRequest({
            payload,
            network: getNetwork(),
            sessionChainId: connection.metadata.chainId,
            knownAddresses: connection.accounts,
        })
        if (!verdict.ok) {
            declineRequest(connection.id, request.id, verdict)
            return
        }

        emitRequest({
            connection,
            requestId: request.id,
            type: 'sign-transactions',
            // The gate proved `params[0]` is a non-empty array; the registry parses it.
            params: Array.isArray(request.params)
                ? request.params[0]
                : undefined,
        })
    }

    const handleSignData: V1ConnectorEventHandler = async (
        connector,
        error,
        payload,
    ) => {
        const opened = await openRequest(
            connector,
            'algo_signData',
            error,
            payload,
        )
        if (!opened) return
        const { request, connection } = opened
        if (!claimRequest(connection.id, request.id, 'algo_signData')) return
        const network = getNetwork()

        // `gateSignDataRequest` rejects the legacy array shape outright, so that
        // branch gets only the chain check; the registry validates its payload.
        const verdict: GateResult = Array.isArray(request.params)
            ? isV1ChainIdAcceptable(connection.metadata.chainId, network) &&
              legacyItemChainIdsAcceptable(request.params, network)
                ? { ok: true }
                : {
                      ok: false,
                      reason: 'chain id not acceptable on the active network',
                      code: 'invalid-network',
                  }
            : gateSignDataRequest({
                  payload,
                  network,
                  sessionChainId: connection.metadata.chainId,
              })
        if (!verdict.ok) {
            declineRequest(connection.id, request.id, verdict)
            return
        }

        emitRequest({
            connection,
            requestId: request.id,
            type: 'sign-data',
            params: request.params,
        })
    }

    // No replay ledger and no error toast: the answer is public, idempotent
    // data the dApp asks for unprompted, so a repeat is simply answered again.
    const handleGetEmptySignatures: V1ConnectorEventHandler = async (
        connector,
        error,
        payload,
    ) => {
        const opened = await openRequest(
            connector,
            GET_EMPTY_SIGNATURES_METHOD,
            error,
            payload,
        )
        if (!opened) return
        const { request, connection } = opened
        const network = getNetwork()
        const result = isV1ChainIdAcceptable(
            connection.metadata.chainId,
            network,
        )
            ? emptySignaturesResult(
                  request.params,
                  connection.accounts,
                  network,
              )
            : null

        try {
            const live = await connectors.ensureReady(
                connection.id,
                WC_DELIVERY_TIMEOUT_MS,
            )
            if (result) {
                live.approveRequest({ id: request.id, result })
            } else {
                live.rejectRequest({
                    id: request.id,
                    error: new WalletConnectInvalidNetworkError(),
                })
            }
        } catch (deliveryError) {
            logger.warn('[WC v1] empty signatures delivery failed', {
                clientId: connection.id,
                requestId: request.id,
                error: deliveryError,
            })
        }
    }

    return {
        connectionFor,
        handleSignTxn,
        handleSignData,
        handleGetEmptySignatures,
    }
}
