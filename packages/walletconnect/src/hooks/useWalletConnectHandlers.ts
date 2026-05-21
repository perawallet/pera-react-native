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

import {
    decodeFromBase64,
    encodeToBase64,
    generateOrderedUniqueId,
    logger,
    Network,
    Networks,
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
    PeraSignedTransaction,
    useTransactionEncoder,
    validateArc0001SignTxnParams,
} from '@perawallet/wallet-core-blockchain'
import {
    type ArbitraryDataSignRequest,
    type Arc60Metadata,
    type Arc60SignRequest,
    type Arc60StdSigData,
    type PeraArbitraryDataMessage,
    type PeraArbitraryDataSignResult,
    type TransactionSignRequest,
    resolveSignableTransactions,
    useSigningRequest,
} from '@perawallet/wallet-core-signing'
import WalletConnect from '@walletconnect/client'
import { useCallback } from 'react'
import {
    AlgorandChainId,
    WalletConnectConnection,
    WalletConnectTransactionPayload,
} from '../models'
import { MAX_DATA_SIGN_REQUESTS, WC_DELIVERY_TIMEOUT_MS } from '../constants'
import { arc60PayloadSchema } from '../schema'
import {
    canSignArbitraryData,
    useAllAccounts,
    useSigningAccounts,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'

/**
 * A WalletConnect delivery-connection timeout is owned end-to-end by the
 * signing machine: it lands the request in `failed`, the inline error
 * sheet renders with a Retry, and a retry re-attempts delivery on a fresh
 * socket. A request's `error` callback must therefore NOT also pop the WC
 * error bottom sheet, drain the sign-request queue, or reject the dApp on
 * a timeout — each would fight that flow (a drained queue kills the retry
 * and orphans the actor; an early `rejectRequest` burns a request id the
 * retry still needs).
 *
 * The callback is invoked both with the raw timeout error (from the
 * WalletConnect transport's catch) and with the `TransportError` that
 * wraps it (from the signing machine's `failed` handler), so match both
 * shapes — `AppError` exposes the wrapped cause as `originalError`.
 */
const isConnectionTimeout = (error: unknown): boolean =>
    error instanceof WalletConnectConnectionTimeoutError ||
    (error instanceof Error &&
        (error as { originalError?: unknown }).originalError instanceof
            WalletConnectConnectionTimeoutError)

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

    const expectedChainId =
        network === Networks.testnet
            ? AlgorandChainId.testnet
            : AlgorandChainId.mainnet

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

    const expectedChainId =
        network === Networks.testnet
            ? AlgorandChainId.testnet
            : AlgorandChainId.mainnet

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
        if (!account || !canSignArbitraryData(account, accounts)) {
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
    if (!account || !canSignArbitraryData(account, accounts)) {
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

    return {
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
}

export const useWalletConnectHandlers = () => {
    const connections = useWalletConnectStore(
        state => state.walletConnectConnections,
    )
    const { addSignRequest, removeSignRequest, clearLastFailedRequest } =
        useSigningRequest()
    const { encodeSignedTransactions, decodeTransactions } =
        useTransactionEncoder()
    const accounts = useAllAccounts()
    const signingAccounts = useSigningAccounts()

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
                    // Guarantee a live bridge socket before responding —
                    // WC v1 silently queues into a dead socket. Throws a
                    // WalletConnectConnectionTimeoutError the signing
                    // pipeline surfaces as an honest failure if the socket
                    // can't be revived.
                    const readyConnector = await ensureConnectorReady(
                        connector.clientId,
                        WC_DELIVERY_TIMEOUT_MS,
                    )
                    await readyConnector.approveRequest({
                        id: payload.id,
                        result,
                    })
                },
                reject: async () => {
                    connector.rejectRequest({
                        id: payload.id,
                        error: new Error('User rejected'),
                    })
                },
                error: async (err: Error) => {
                    // A delivery-connection timeout is surfaced and retried
                    // by the signing machine — bail so we don't double up
                    // the UI or kill the retry. See isConnectionTimeout.
                    if (isConnectionTimeout(err)) {
                        return
                    }
                    connector.rejectRequest({
                        id: payload.id,
                        error: err,
                    })
                    useWalletConnectStore
                        .getState()
                        .setConnectionError(
                            new WalletConnectSignRequestError(err.message),
                        )
                    // Pull the request out of the queue and clear the
                    // failed-request flag so the WC error bottom sheet is the
                    // only surface — otherwise we'd also flash the signing
                    // pipeline's full-screen "Signing Failed" view.
                    clearLastFailedRequest()
                    removeSignRequest(signRequest)
                },
            } as Arc60SignRequest
            addSignRequest(signRequest)
        },
        [
            connections,
            accounts,
            addSignRequest,
            removeSignRequest,
            clearLastFailedRequest,
        ],
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
                        // Guarantee a live bridge socket before responding
                        // — WC v1 silently queues into a dead socket.
                        // Throws a WalletConnectConnectionTimeoutError the
                        // signing pipeline surfaces as an honest failure if
                        // the socket can't be revived.
                        const readyConnector = await ensureConnectorReady(
                            connector.clientId,
                            WC_DELIVERY_TIMEOUT_MS,
                        )
                        await readyConnector.approveRequest({
                            id: payload.id,
                            result,
                        })
                    }
                },
                reject: async () => {
                    connector.rejectRequest({
                        id: payload.id,
                        error: new Error('User rejected'),
                    })
                },
                error: async (error: Error) => {
                    // A delivery-connection timeout is surfaced and retried
                    // by the signing machine — bail so we don't double up
                    // the UI or kill the retry. See isConnectionTimeout.
                    if (isConnectionTimeout(error)) {
                        return
                    }
                    connector.rejectRequest({
                        id: payload.id,
                        error,
                    })
                    useWalletConnectStore
                        .getState()
                        .setConnectionError(
                            new WalletConnectSignRequestError(error.message),
                        )
                    clearLastFailedRequest()
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
            clearLastFailedRequest,
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
            validateRequest(connector, connections, network, error)
            const paramOne = payload?.params?.at(0)
            if (!payload || !paramOne) {
                throw new WalletConnectSignRequestError(
                    'Invalid data found - parameter required',
                )
            }

            // ARC-0001: reject malformed address fields (bad authAddr / signers)
            // before decoding so the user sees a wallet-side error instead of
            // the signing sheet for txns the node would reject anyway.
            // (Group ID integrity is validated downstream by the signing
            // pipeline analyzer, since it applies to every signing source.)
            const arc0001Error = validateArc0001SignTxnParams(paramOne)
            if (arc0001Error) {
                throw new WalletConnectSignRequestError(arc0001Error.message)
            }

            // Decode all transactions upfront so we can inspect senders
            const allTxnObjects = decodeTransactions(
                paramOne.map(p => decodeFromBase64(p.txn)),
            )

            // ARC-0001: determine which transactions this wallet should sign
            const signableAddresses = new Set(
                signingAccounts.map(a => a.address),
            )
            const { indicesToSign, signerOverrides } =
                resolveSignableTransactions(
                    paramOne,
                    allTxnObjects.map(tx => tx.sender.toString()),
                    signableAddresses,
                )

            // If no transactions need signing, approve with all-null array.
            // This delivers outside the signing machine (no review/retry
            // UI), so respond best-effort: ensure a live socket first —
            // WC v1 silently queues into a dead one — then log if it
            // could not be revived.
            if (indicesToSign.length === 0) {
                const allNullResult = new Array(paramOne.length).fill(null)
                void ensureConnectorReady(
                    connector.clientId,
                    WC_DELIVERY_TIMEOUT_MS,
                )
                    .then(readyConnector =>
                        readyConnector.approveRequest({
                            id: payload.id,
                            result: allNullResult,
                        }),
                    )
                    .catch(error => {
                        logger.error(
                            'WC: failed to deliver all-null sign response',
                            { error, clientId: connector.clientId },
                        )
                    })
                return
            }

            const signableTxns = indicesToSign.map(i => allTxnObjects[i])
            const signableRawTxns = indicesToSign.map(i => paramOne[i].txn)

            const signRequest: TransactionSignRequest = {
                id: generateOrderedUniqueId(),
                type: 'transactions',
                transport: 'callback',
                sourceType: 'walletconnect',
                transportId: connector.clientId,
                txs: signableTxns,
                // Carry the full pre-filter payload so the signing pipeline
                // can validate atomic-group integrity. `txs` only holds this
                // wallet's signable subset and can't recompute the group
                // hash on its own (e.g. express-send shape: each side sees
                // only half the group).
                groupContext: allTxnObjects,
                rawTransactionsBase64: signableRawTxns,
                signerOverrides:
                    signerOverrides.size > 0 ? signerOverrides : undefined,
                sourceMetadata: connector.session?.peerMeta,
                approve: async (signed: Nullable<PeraSignedTransaction>[]) => {
                    // Reconstruct full-length response with null at skipped positions
                    const result: Nullable<string>[] = new Array(
                        paramOne.length,
                    ).fill(null)
                    signed.forEach((tx, i) => {
                        if (tx) {
                            const [encoded] = encodeSignedTransactions([tx])
                            result[indicesToSign[i]] = encodeToBase64(encoded)
                        }
                    })

                    // Guarantee a live bridge socket before responding.
                    // WC v1 silently queues the response into a dead
                    // socket, so without this the dApp never receives the
                    // signed transaction once the app has been
                    // backgrounded — yet the UI still reports success.
                    // ensureConnectorReady throws a
                    // WalletConnectConnectionTimeoutError if the socket
                    // can't be revived, failing the signing pipeline
                    // honestly instead of faking success.
                    const readyConnector = await ensureConnectorReady(
                        connector.clientId,
                        WC_DELIVERY_TIMEOUT_MS,
                    )
                    await readyConnector.approveRequest({
                        id: payload.id,
                        result,
                    })
                },
                reject: async () => {
                    connector.rejectRequest({
                        id: payload.id,
                        error: new Error('User rejected'),
                    })
                },
                error: async (error: Error) => {
                    // A delivery-connection timeout is surfaced and retried
                    // by the signing machine — bail so we don't double up
                    // the UI or kill the retry. See isConnectionTimeout.
                    if (isConnectionTimeout(error)) {
                        return
                    }
                    connector.rejectRequest({
                        id: payload.id,
                        error,
                    })
                    useWalletConnectStore
                        .getState()
                        .setConnectionError(
                            new WalletConnectSignRequestError(error.message),
                        )
                    clearLastFailedRequest()
                    removeSignRequest(signRequest)
                },
                // Sync-flow multisig handoff: invoked by
                // createMultisigProposeTransport after a successful
                // backend propose. The dApp request is rejected so the
                // peer doesn't hang for the WC protocol timeout, but
                // unlike `error` we don't set a connection-error banner
                // — the user successfully created a sign-request, this
                // is not a failure. removeSignRequest is defensive; the
                // signing lifecycle already removes the request on the
                // `completed` transition (useSigningActorLifecycle).
                softReject: async (error: Error) => {
                    connector.rejectRequest({
                        id: payload.id,
                        error,
                    })
                    removeSignRequest(signRequest)
                },
                // Sync-flow multisig success delivery: invoked by the
                // resolver listener once threshold is met and the
                // composite multisig SignedTransaction has been
                // assembled. Bytes embed the original `txn` payload
                // verbatim (no algosdk decode + re-encode), so the
                // collected per-participant signatures verify on algod
                // when the dApp broadcasts. Align each item with the
                // corresponding position in the original `algo_signTxn`
                // request via `indicesToSign`.
                approveSignedBytes: async (signedBytes: Uint8Array[]) => {
                    const result: Nullable<string>[] = new Array(
                        paramOne.length,
                    ).fill(null)
                    signedBytes.forEach((bytes, i) => {
                        const idx = indicesToSign[i]
                        if (idx === undefined) return
                        result[idx] = encodeToBase64(bytes)
                    })
                    // Guarantee a live bridge socket before responding —
                    // WC v1 silently queues into a dead socket.
                    const readyConnector = await ensureConnectorReady(
                        connector.clientId,
                        WC_DELIVERY_TIMEOUT_MS,
                    )
                    await readyConnector.approveRequest({
                        id: payload.id,
                        result,
                    })
                },
            } as TransactionSignRequest
            addSignRequest(signRequest)
        },
        [
            connections,
            addSignRequest,
            removeSignRequest,
            clearLastFailedRequest,
            signingAccounts,
        ],
    )

    return {
        handleSignData,
        handleArc60SignData,
        handleSignTransaction,
    }
}
