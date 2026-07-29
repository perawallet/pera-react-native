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
    decodeFromBase64,
    encodeToBase64,
    generateOrderedUniqueId,
    logger,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    WalletConnectConnectionTimeoutError,
    WalletConnectInvalidNetworkError,
    WalletConnectInvalidSessionError,
    WalletConnectSignRequestError,
} from '../errors'
import { ensureConnectorReady } from '../connection'
import { useWalletConnectStore } from '../store'
import {
    type ArbitraryDataSignRequest,
    type Arc60Metadata,
    type Arc60SignRequest,
    type Arc60StdSigData,
    type PeraArbitraryDataMessage,
    type PeraArbitraryDataSignResult,
    type RejectReason,
    useArc0001Resolver,
    useEnqueueArc0001SignRequest,
    useSigningRequest,
    validateArc60AuthRequest,
} from '@perawallet/wallet-core-signing'
import type WalletConnect from '@perawallet/walletconnect'
import { useCallback } from 'react'
import {
    AlgorandChainId,
    type WalletConnectConnection,
    type WalletConnectTransactionPayload,
} from '../models'
import { getExpectedChainId } from '../utils/expectedChainId'
import { MAX_DATA_SIGN_REQUESTS, WC_DELIVERY_TIMEOUT_MS } from '../constants'
import { arc60PayloadSchema, assertArc60RequestWithinLimits } from '../schema'
import {
    canSignArbitraryData,
    canSignArc60,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

// A delivery-connection timeout is owned by the signing machine
// (retryable via the inline error sheet). The error callback receives
// both the raw error and a wrapping `TransportError` whose cause is
// exposed as `originalError`, so check both shapes.
const isConnectionTimeout = (error: unknown): boolean =>
    error instanceof WalletConnectConnectionTimeoutError ||
    (error instanceof Error &&
        (error as { originalError?: unknown }).originalError instanceof
            WalletConnectConnectionTimeoutError)

/**
 * Guarantee a live bridge socket before responding — WC v1 silently
 * queues into a dead socket once the app has been backgrounded.
 * `ensureConnectorReady` throws `WalletConnectConnectionTimeoutError` if
 * it can't be revived; the signing pipeline surfaces that as a retryable
 * failure.
 */
const deliverApprove = async (
    clientId: string,
    id: number,
    result: unknown,
): Promise<void> => {
    const readyConnector = await ensureConnectorReady(
        clientId,
        WC_DELIVERY_TIMEOUT_MS,
    )
    await readyConnector.approveRequest({ id, result })
}

const deliverReject = async (
    clientId: string,
    id: number,
    error: Error,
): Promise<void> => {
    const readyConnector = await ensureConnectorReady(
        clientId,
        WC_DELIVERY_TIMEOUT_MS,
    )
    readyConnector.rejectRequest({ id, error })
}

/**
 * Fire-and-forget variant for user rejections and error responses —
 * cleanup paths that must never throw back into the caller. A failed
 * revival is logged and dropped: the dApp times out exactly as it would
 * have when the response was queued into the dead socket.
 */
const deliverRejectInBackground = (
    clientId: string,
    id: number,
    error: Error,
): void => {
    void deliverReject(clientId, id, error).catch((deliveryError: unknown) => {
        logger.warn('WC reject delivery failed', {
            clientId,
            id,
            error:
                deliveryError instanceof Error
                    ? deliveryError.message
                    : String(deliveryError),
        })
    })
}

const validateRequest = (
    connector: WalletConnect,
    connections: WalletConnectConnection[],
    network: Network,
    error: Nullable<Error>,
): WalletConnectConnection => {
    if (error) {
        logger.error(error)
        throw new WalletConnectSignRequestError(
            'An error occurred while handling a wallet connect request.',
            error,
        )
    }

    const foundConnection = connections.find(
        conn => conn.clientId === connector.clientId,
    )

    if (!foundConnection || !foundConnection.session) {
        logger.debug('No session found', {
            clientId: connector.clientId,
            connections,
        })

        throw new WalletConnectInvalidSessionError('No session found')
    }

    const expectedChainId = getExpectedChainId(network)

    const { chainId } = foundConnection.session

    if (chainId !== AlgorandChainId.all && chainId !== expectedChainId) {
        logger.debug('Invalid network', {
            clientId: connector.clientId,
            connections,
        })
        throw new WalletConnectInvalidNetworkError()
    }

    return foundConnection
}

const validateDataSignRequest = (
    connector: WalletConnect,
    accounts: WalletAccount[],
    connections: WalletConnectConnection[],
    network: Network,
    data: PeraArbitraryDataMessage[],
    error: Nullable<Error>,
) => {
    const foundSession = validateRequest(connector, connections, network, error)

    if (!data) {
        throw new WalletConnectSignRequestError('No data found')
    }

    if (!Array.isArray(data) || data.length === 0) {
        throw new WalletConnectSignRequestError('Invalid data found')
    }

    if (data.length > MAX_DATA_SIGN_REQUESTS) {
        throw new WalletConnectSignRequestError('Too many sign requests found')
    }

    const expectedChainId = getExpectedChainId(network)

    data.forEach(item => {
        if (
            item.chainId !== AlgorandChainId.all &&
            item.chainId !== expectedChainId
        ) {
            throw new WalletConnectInvalidNetworkError("ChainId doesn't match")
        }

        if (!foundSession.session?.accounts.includes(item.signer)) {
            throw new WalletConnectInvalidSessionError('Invalid signer')
        }

        const account = accounts.find(
            account => account.address === item.signer,
        )
        if (!account || !canSignArbitraryData(account)) {
            throw new WalletConnectInvalidSessionError(
                'Signer cannot sign arbitrary data',
            )
        }

        if (!item.data) {
            throw new WalletConnectSignRequestError('Data is missing')
        }
    })
}

/**
 * Validates an ARC-60 `algo_signData` payload before queueing it.
 *
 * Split into two layers:
 *   1. Shape validation via {@link arc60PayloadSchema} — zod errors are
 *      projected into `WalletConnectSignRequestError` with a field path
 *      (e.g. `metadata.scope: Expected number, received string`).
 *   2. Semantic checks — signer belongs to the session, is signable, and
 *      is not a hardware wallet.
 *
 * Returns the parsed `Arc60StdSigData` / `Arc60Metadata` with
 * `authenticatorData` already base64-decoded so the caller doesn't repeat it.
 */
const validateArc60Request = (
    connector: WalletConnect,
    accounts: WalletAccount[],
    connections: WalletConnectConnection[],
    network: Network,
    rawParams: unknown,
    error: Nullable<Error>,
): { stdSigData: Arc60StdSigData; metadata: Arc60Metadata } => {
    const foundSession = validateRequest(connector, connections, network, error)
    assertArc60RequestWithinLimits(rawParams)

    const parsed = arc60PayloadSchema.safeParse(rawParams)
    if (!parsed.success) {
        // z.prettifyError would be nicer but is zod 4+; join issues manually
        // so the dApp gets a field-path breadcrumb.
        const summary = parsed.error.issues
            .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
            .join('; ')
        throw new WalletConnectSignRequestError(
            `Invalid ARC-60 sign request payload — ${summary}`,
        )
    }
    const {
        data,
        signer,
        domain,
        authenticatorData,
        requestId,
        hdPath,
        metadata,
    } = parsed.data

    if (!foundSession.session?.accounts.includes(signer)) {
        throw new WalletConnectInvalidSessionError('Invalid signer')
    }
    const account = accounts.find(a => a.address === signer)
    // canSignArc60 covers both ARC-60 signing paths: local-key (Algo25/HD)
    // via KMS and hardware (Ledger) on-device. Watch and multisig accounts
    // can do neither, so they're rejected here.
    if (!account || !canSignArc60(account)) {
        throw new WalletConnectInvalidSessionError(
            'Signer cannot sign ARC-60 payloads',
        )
    }

    let decodedAuthData: Uint8Array
    try {
        decodedAuthData = decodeFromBase64(authenticatorData)
    } catch (decodeError) {
        throw new WalletConnectSignRequestError(
            'Invalid ARC-60 sign request payload — `authenticatorData` is not valid base64',
            decodeError as Error,
        )
    }

    const result = {
        stdSigData: {
            data,
            signer,
            domain,
            authenticatorData: decodedAuthData,
            requestId,
            hdPath,
        },
        metadata,
    }

    validateArc60AuthRequest(result.stdSigData, result.metadata, accounts)

    return result
}

export const useWalletConnectHandlers = () => {
    const connections = useWalletConnectStore(
        state => state.walletConnectConnections,
    )
    const { addSignRequest, removeSignRequest } = useSigningRequest()
    const accounts = useAllAccounts()
    const resolveArc0001 = useArc0001Resolver()
    const enqueueSignRequest = useEnqueueArc0001SignRequest()

    const handleArc60SignData = useCallback(
        (
            connector: WalletConnect,
            network: Network,
            error: Nullable<Error>,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            payload: any,
        ) => {
            const { stdSigData, metadata } = validateArc60Request(
                connector,
                accounts,
                connections,
                network,
                payload?.params,
                error,
            )

            const signRequest: Arc60SignRequest = {
                id: generateOrderedUniqueId(),
                type: 'arc60',
                transport: 'callback',
                sourceType: 'walletconnect',
                transportId: connector.clientId,
                sourceMetadata: connector.session?.peerMeta,
                stdSigData,
                metadata,
                approve: async (signed: PeraArbitraryDataSignResult[]) => {
                    // ARC-60 produces a single signature; the WC bridge
                    // mirrors the legacy `algo_signData` response shape
                    // (array of base64 strings) for consistency.
                    const result = signed.map(item =>
                        encodeToBase64(item.signature),
                    )
                    await deliverApprove(connector.clientId, payload.id, result)
                },
                reject: async (reason: RejectReason = { kind: 'user' }) => {
                    if (reason.kind === 'softReject') {
                        await deliverReject(
                            connector.clientId,
                            payload.id,
                            reason.error,
                        )
                        removeSignRequest(signRequest)
                        return
                    }
                    deliverRejectInBackground(
                        connector.clientId,
                        payload.id,
                        new Error('User rejected'),
                    )
                },
                error: async (err: Error) => {
                    if (isConnectionTimeout(err)) {
                        return
                    }
                    deliverRejectInBackground(
                        connector.clientId,
                        payload.id,
                        err,
                    )
                    useWalletConnectStore
                        .getState()
                        .setConnectionError(
                            new WalletConnectSignRequestError(err.message),
                        )
                    // The WC error bottom sheet is the only surface here;
                    // SignRequestView already returns null for walletconnect
                    // sources when a failed event arrives, so removing the
                    // request from the queue is sufficient cleanup.
                    removeSignRequest(signRequest)
                },
            } as Arc60SignRequest
            addSignRequest(signRequest)
        },
        [connections, accounts, addSignRequest, removeSignRequest],
    )

    const handleSignData = useCallback(
        (
            connector: WalletConnect,
            network: Network,
            error: Nullable<Error>,
            //TODO type this correctly
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            payload: Nullable<any>,
        ) => {
            const params = payload?.params

            // ARC-60 (`StdSigData` + `Metadata`) is delivered as a single
            // object with an `authenticatorData` field, distinguishing it
            // from the legacy arbitrary-data shape (an array of
            // `PeraArbitraryDataMessage`). Detect on either signal so dApps
            // that omit one don't slip through.
            const isArc60Payload =
                params != null &&
                !Array.isArray(params) &&
                (params.authenticatorData != null ||
                    params.metadata?.scope != null)

            if (isArc60Payload) {
                handleArc60SignData(connector, network, error, payload)
                return
            }

            validateDataSignRequest(
                connector,
                accounts,
                connections,
                network,
                params,
                error,
            )

            const signRequest: ArbitraryDataSignRequest = {
                id: generateOrderedUniqueId(),
                type: 'arbitrary-data',
                transport: 'callback',
                sourceType: 'walletconnect',
                transportId: connector.clientId,
                sourceMetadata: connector.session?.peerMeta,
                data: params,
                approve: async (signedData: PeraArbitraryDataSignResult[]) => {
                    if (signedData) {
                        const result = signedData.map(item =>
                            encodeToBase64(item.signature),
                        )
                        await deliverApprove(
                            connector.clientId,
                            payload.id,
                            result,
                        )
                    }
                },
                reject: async (reason: RejectReason = { kind: 'user' }) => {
                    if (reason.kind === 'softReject') {
                        await deliverReject(
                            connector.clientId,
                            payload.id,
                            reason.error,
                        )
                        removeSignRequest(signRequest)
                        return
                    }
                    deliverRejectInBackground(
                        connector.clientId,
                        payload.id,
                        new Error('User rejected'),
                    )
                },
                error: async (error: Error) => {
                    if (isConnectionTimeout(error)) {
                        return
                    }
                    deliverRejectInBackground(
                        connector.clientId,
                        payload.id,
                        error,
                    )
                    useWalletConnectStore
                        .getState()
                        .setConnectionError(
                            new WalletConnectSignRequestError(error.message),
                        )
                    removeSignRequest(signRequest)
                },
            } as ArbitraryDataSignRequest
            addSignRequest(signRequest)
        },
        [
            connections,
            accounts,
            addSignRequest,
            removeSignRequest,
            handleArc60SignData,
        ],
    )

    const handleSignTransaction = useCallback(
        (
            connector: WalletConnect,
            network: Network,
            error: Nullable<Error>,
            payload: Nullable<WalletConnectTransactionPayload>,
        ) => {
            logger.debug('handleSignTransaction', { payload, network })
            const foundSession = validateRequest(
                connector,
                connections,
                network,
                error,
            )
            const paramOne = payload?.params?.at(0)
            if (!payload || !paramOne) {
                throw new WalletConnectSignRequestError(
                    'Invalid data found - parameter required',
                )
            }

            // authorizedAddresses binds this WC session to its approved
            // accounts — prevents a session for A being used to sign for B.
            const resolved = resolveArc0001(
                { transactions: paramOne },
                {
                    authorizedAddresses: new Set(
                        foundSession.session?.accounts ?? [],
                    ),
                },
            )

            // enqueueSignRequest is async (PQ-017 may fetch suggested params
            // for a quantum signer), but this handler must stay synchronous:
            // the WC listener wraps it in a sync try/catch and unit tests
            // assert its validate/resolve throws propagate synchronously.
            // The enqueue handles its own failures via `respondWithError`, so
            // fire-and-forget is safe here.
            void enqueueSignRequest(resolved, {
                sourceType: 'walletconnect',
                transportId: connector.clientId,
                sourceMetadata: connector.session?.peerMeta ?? undefined,
                // deliverApprove guards the WC v1 dead-socket case: the
                // bridge can silently drop our response once the app has
                // been backgrounded. ensureConnectorReady revives it (or
                // throws a retryable timeout). Same goes for deliverReject.
                respondWithResult: result =>
                    deliverApprove(connector.clientId, payload.id, result),
                respondWithReject: () =>
                    deliverRejectInBackground(
                        connector.clientId,
                        payload.id,
                        new Error('User rejected'),
                    ),
                // softReject: the multisig propose handoff succeeded, so
                // we tell the dApp peer the request was rejected without
                // raising the connection-error banner on our side.
                respondWithSoftReject: error =>
                    deliverReject(connector.clientId, payload.id, error),
                respondWithError: error => {
                    if (isConnectionTimeout(error)) return
                    deliverRejectInBackground(
                        connector.clientId,
                        payload.id,
                        error,
                    )
                    useWalletConnectStore
                        .getState()
                        .setConnectionError(
                            new WalletConnectSignRequestError(error.message),
                        )
                },
            })
        },
        [connections, enqueueSignRequest, resolveArc0001],
    )

    return {
        handleSignData,
        handleArc60SignData,
        handleSignTransaction,
    }
}
