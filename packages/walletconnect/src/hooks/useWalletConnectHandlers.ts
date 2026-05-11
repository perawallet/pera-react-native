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
    WalletConnectInvalidNetworkError,
    WalletConnectInvalidSessionError,
    WalletConnectSignRequestError,
} from '../errors'
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
import { MAX_DATA_SIGN_REQUESTS } from '../constants'
import { arc60PayloadSchema } from '../schema'
import {
    canSignWithAccount,
    isHardwareWalletAccount,
    useAllAccounts,
    useSigningAccounts,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'

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
        if (!account || !canSignWithAccount(account, accounts)) {
            throw new WalletConnectInvalidSessionError('Invalid signer')
        }

        if (isHardwareWalletAccount(account)) {
            throw new WalletConnectInvalidSessionError(
                'Hardware wallet accounts are not supported',
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
    if (!account || !canSignWithAccount(account, accounts)) {
        throw new WalletConnectInvalidSessionError('Invalid signer')
    }
    if (isHardwareWalletAccount(account)) {
        throw new WalletConnectInvalidSessionError(
            'Hardware wallet accounts are not supported',
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
                    try {
                        // ARC-60 produces a single signature; the WC bridge
                        // mirrors the legacy `algo_signData` response shape
                        // (array of base64 strings) for consistency.
                        const result = signed.map(item =>
                            encodeToBase64(item.signature),
                        )
                        await connector.approveRequest({
                            id: payload.id,
                            result,
                        })
                    } catch (err) {
                        connector.rejectRequest({
                            id: payload.id,
                            error: err as Error,
                        })
                    }
                },
                reject: async () => {
                    connector.rejectRequest({
                        id: payload.id,
                        error: new Error('User rejected'),
                    })
                },
                error: async (err: Error) => {
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
                    try {
                        if (signedData) {
                            const result = signedData.map(item =>
                                encodeToBase64(item.signature),
                            )
                            const toSend = {
                                id: payload.id,
                                result,
                            }
                            await connector.approveRequest(toSend)
                        }
                    } catch (error) {
                        connector.rejectRequest({
                            id: payload.id,
                            error: error as Error,
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

            // If no transactions need signing, approve with all-null array
            if (indicesToSign.length === 0) {
                connector.approveRequest({
                    id: payload.id,
                    result: new Array(paramOne.length).fill(null),
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

                    connector.approveRequest({
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
