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
import { isChainIdAcceptable } from '../shared/chain'
import { toWireResult } from '../shared/wire'
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
}

export const createV1RequestHandlers = (deps: {
    kit: HandlerKit
    connectors: Pick<WalletConnectConnectorRegistry, 'ensureReady'>
    getNetwork: () => Network
}): V1RequestHandlers => {
    const { kit, connectors, getNetwork } = deps
    const { reportError, store, recordActivity, requireContext } = kit

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
            .then(connector =>
                connector.rejectRequest({ id: requestId, error }),
            )
            .catch((deliveryError: unknown) => {
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
        }

        requireContext().onMessage({
            kind: 'request',
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
                        result: toWireResult(result),
                    }),
                ),
            reject: error =>
                deliver(connector =>
                    connector.rejectRequest({ id: requestId, error }),
                ),
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
        const network = getNetwork()

        // `gateSignDataRequest` rejects the legacy array shape outright, so that
        // branch gets only the chain check; the registry validates its payload.
        const verdict: GateResult = Array.isArray(request.params)
            ? isChainIdAcceptable(connection.metadata.chainId, network) &&
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

    return { connectionFor, handleSignTxn, handleSignData }
}
