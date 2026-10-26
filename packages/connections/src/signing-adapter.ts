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

import { useEffect, useMemo, useRef } from 'react'
import type {
    ChainId,
    ChainScope,
    NetworkId,
    SignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { getSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    generateOrderedUniqueId,
    isRetryableError,
    logger,
    toError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    MAX_DATA_SIGN_REQUESTS,
    canSignMessage,
    isFeeAdjustmentDeliveryError,
    isSignRequestPastApproval,
    isSignRequestPending,
    messageSignerChainAdapters,
    useSigningRequest,
    type AuthDataSignRequest,
    type AuthDataSignableData,
    type ArbitraryDataSignRequest,
    type MessageSignRequest,
    type PeraArbitraryDataMessage,
    type PeraArbitraryDataSignResult,
    type RejectReason,
    type SignRequest,
    type UnsignedTransactionSignRequest,
} from '@perawallet/wallet-core-signing'
import type {
    ConnectionId,
    ConnectionPeer,
} from '@perawallet/wallet-extension-connections'
import {
    authorityOf,
    chainAccountOf,
    findAccountByAddressOn,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    DappRequestRejectedError,
    PendingRequestCapacityError,
    dappRequestChainAdapters,
    type EnqueueTransactionSigning,
} from './dappRequest'
import { pendingCapacityBreach } from './capacity'
import { ConnectionsError } from './errors'
import type {
    ConnectionErrorScope,
    DappMessageRequest,
    InboundMessage,
    MessageOperationType,
} from './models'
import type { ConnectionRegistry } from './registry'

/**
 * The mounted chain's transaction-signing enqueue. Keyed by chain rather than compared against the message's chain, so shared
 * code never branches on a chain id: a message for an unmounted chain simply
 * finds no entry.
 */
export type ChainTransactionSigning = ReadonlyMap<
    ChainId,
    EnqueueTransactionSigning
>

type RequestMessage = Extract<InboundMessage, { kind: 'request' }>
type ExpiredMessage = Extract<InboundMessage, { kind: 'request-expired' }>

/**
 * One request the pipeline is holding open for the user. `request` is null
 * while the chain's signing enqueue is still pending; an expiry or close
 * landing in that window marks the entry and the enqueue's continuation withdraws.
 * A network-switch prompt has no sign request, so it carries `dismiss` instead.
 */
type PendingRequest = {
    connectionId: ConnectionId
    request: Nullable<SignRequest>
    dismiss?: () => void
    isWithdrawn: boolean
}

export type PendingRequestLedger = Map<string, PendingRequest>

const requestKey = (message: {
    connectionId: string
    correlationId: string
}): string => `${message.connectionId}\u0000${message.correlationId}`

const trackRequest = (
    deps: EnqueueInboundRequestDeps,
    message: RequestMessage,
    request: Nullable<SignRequest>,
    dismiss?: () => void,
): void => {
    deps.pendingRequests.set(requestKey(message), {
        connectionId: message.connectionId,
        request,
        dismiss,
        isWithdrawn: false,
    })
}

const forgetRequest = (
    deps: EnqueueInboundRequestDeps,
    message: RequestMessage,
): void => {
    deps.pendingRequests.delete(requestKey(message))
}

/** The async enqueue settled: hand over the request, or honour an expiry or close that beat it. */
const settleTrackedRequest = (
    deps: EnqueueInboundRequestDeps,
    message: RequestMessage,
    request: Nullable<SignRequest>,
): void => {
    const key = requestKey(message)
    const entry = deps.pendingRequests.get(key)
    if (!request || !entry) {
        deps.pendingRequests.delete(key)
        return
    }
    if (entry.isWithdrawn) {
        deps.pendingRequests.delete(key)
        deps.removeSignRequest(request)
        return
    }
    entry.request = request
}

// An approved request is left to finish: a send-transaction broadcast goes out
// regardless, and its answer simply fails against the gone peer.
const withdrawTrackedRequest = (
    deps: EnqueueInboundRequestDeps,
    key: string,
    entry: PendingRequest,
): void => {
    if (entry.dismiss) {
        deps.pendingRequests.delete(key)
        entry.dismiss()
        return
    }
    if (!entry.request) {
        entry.isWithdrawn = true
        return
    }
    if (deps.isSignRequestPastApproval(entry.request.id)) return
    deps.pendingRequests.delete(key)
    deps.removeSignRequest(entry.request)
}

// Not reported here: the handler that saw the expiry owns the user-facing
// error. An unknown key is a request already answered or refused.
const withdrawExpiredRequest = (
    message: ExpiredMessage,
    deps: EnqueueInboundRequestDeps,
): void => {
    const key = requestKey(message)
    const entry = deps.pendingRequests.get(key)
    if (entry) withdrawTrackedRequest(deps, key, entry)
}

const withdrawClosedConnection = (
    connectionId: ConnectionId,
    deps: EnqueueInboundRequestDeps,
): void => {
    for (const [key, entry] of deps.pendingRequests) {
        if (entry.connectionId === connectionId) {
            withdrawTrackedRequest(deps, key, entry)
        }
    }
}

/**
 * The connection of every request still open. A request can leave the queue
 * without an answer (the sheet's dismiss removes it directly), so its entry is
 * dropped here rather than held against its connection's cap for good.
 */
const openRequestConnections = (deps: EnqueueInboundRequestDeps): string[] => {
    for (const [key, entry] of deps.pendingRequests) {
        if (entry.request && !deps.isSignRequestPending(entry.request.id)) {
            deps.pendingRequests.delete(key)
        }
    }
    return [...deps.pendingRequests.values()].map(entry => entry.connectionId)
}

/** Where a failure the user should hear about goes; the registry's channel on mobile. */
export type ConnectionErrorReporter = (
    error: Error,
    scope: ConnectionErrorScope,
) => void

/**
 * A failed reject delivery has nowhere to propagate (the contract returns
 * `void`) and un-caught it red-boxes React Native. The sync `try` covers a
 * `reject` that throws before its first `await`, inside the handler's listener.
 */
const rejectInBackground = (message: RequestMessage, error: Error): void => {
    const onFailure = (deliveryError: unknown): void => {
        logger.warn('[connections] reject delivery failed', {
            connectionId: message.connectionId,
            error: deliveryError,
        })
    }
    try {
        message.reject(error).catch(onFailure)
    } catch (syncError) {
        onFailure(syncError)
    }
}

/**
 * Answers the peer AND tells the user. Everything that refuses a request
 * before signing goes through here; a user reject and a soft reject do not.
 */
const declineRequest = (
    message: RequestMessage,
    error: Error,
    onError?: ConnectionErrorReporter,
): void => {
    onError?.(error, { connectionId: message.connectionId })
    rejectInBackground(message, error)
}

/**
 * A retryable failure is the signing machine's to retry, and the request has a
 * single answer: rejecting the peer here consumes it, so the user's RETRY would
 * fail `already-answered` against a dApp that has already given up. Nor is it
 * reported, since the RETRY sheet is the surface; the fee-adjusted delivery
 * failure is the exception, because only its toast tells the user the dApp may
 * not accept the higher fees. Returns whether the request is finished with.
 */
const failRequest = (
    message: RequestMessage,
    error: Error,
    onError?: ConnectionErrorReporter,
): boolean => {
    const isRetryable = isRetryableError(error)
    if (!isRetryable || isFeeAdjustmentDeliveryError(error)) {
        onError?.(error, { connectionId: message.connectionId })
    }
    if (isRetryable) return false
    rejectInBackground(message, error)
    return true
}

/**
 * The multisig sync-flow handoff persists a JSON-RPC id so a relaunched app can
 * answer the dApp without the enqueue closures. `correlationId` is opaque by
 * contract, so a handler whose ids are not plain integers (WalletConnect v1's
 * are) simply gets no post-kill delivery rather than a NaN one.
 */
const handoffPayloadId = (correlationId: string): number | undefined => {
    if (!/^\d+$/.test(correlationId)) return undefined
    const parsed = Number(correlationId)
    return Number.isSafeInteger(parsed) ? parsed : undefined
}

type DataSignPayload =
    | Pick<AuthDataSignRequest, 'type' | 'authData' | 'metadata'>
    | Pick<ArbitraryDataSignRequest, 'type' | 'data'>

const requestLifecycle = (
    message: RequestMessage,
    deps: EnqueueInboundRequestDeps,
    getSignRequest: () => SignRequest,
): Pick<MessageSignRequest, 'reject' | 'error'> => ({
    reject: async (reason: RejectReason = { kind: 'user' }) => {
        forgetRequest(deps, message)
        if (reason.kind === 'softReject') {
            await message.reject(reason.error)
            deps.removeSignRequest(getSignRequest())
            return
        }
        rejectInBackground(message, new DappRequestRejectedError())
    },
    error: async (error: Error) => {
        if (failRequest(message, error, deps.onError)) {
            forgetRequest(deps, message)
            deps.removeSignRequest(getSignRequest())
        }
    },
})

// ARC-60 and legacy arbitrary-data requests share one wire answer.
const enqueueDataSignRequest = (
    message: RequestMessage,
    payload: DataSignPayload,
    deps: EnqueueInboundRequestDeps,
): void => {
    const { addSignRequest } = deps
    const signRequest: AuthDataSignRequest | ArbitraryDataSignRequest = {
        ...payload,
        id: generateOrderedUniqueId(),
        chainId: message.chainId,
        transport: 'callback',
        sourceType: message.sourceType,
        transportId: message.connectionId,
        sourceMetadata: message.peer,
        verifiedOrigin: message.verifiedOrigin,
        approve: async (signed: PeraArbitraryDataSignResult[]) => {
            await message.respond({
                type: 'sign-data',
                signatures: signed.map(item => item.signature),
            })
            forgetRequest(deps, message)
        },
        ...requestLifecycle(message, deps, () => signRequest),
    }
    addSignRequest(signRequest)
    trackRequest(deps, message, signRequest)
}

// The chain's `plan` runs once here so a payload it refuses (a malformed
// document, one bound to another network) never reaches a review.
const enqueueMessageRequest = (
    message: RequestMessage,
    type: MessageOperationType,
    request: DappMessageRequest,
    deps: EnqueueInboundRequestDeps,
): void => {
    const { accounts, addSignRequest, onError } = deps
    const { chainId } = message
    const scope = getSelectedScope(chainId)
    const kind = type === 'sign-typed-data' ? 'typedData' : 'message'

    // A session account can leave the wallet after the session was approved.
    const account = findAccountByAddressOn(accounts, chainId, request.signer)
    if (!account) {
        declineRequest(
            message,
            new ConnectionsError(
                'unauthorized-account',
                'The signer is not an account of this wallet',
            ),
            onError,
        )
        return
    }
    if (!canSignMessage(chainId, account, kind)) {
        declineRequest(
            message,
            new ConnectionsError(
                'unsupported-operation',
                'The signer cannot sign messages',
            ),
            onError,
        )
        return
    }

    const messageRequest = { ...request, scope }
    try {
        messageSignerChainAdapters
            .get(chainId)
            .plan(messageRequest, { account, accounts })
    } catch (error) {
        declineRequest(
            message,
            new ConnectionsError(
                'invalid-payload',
                toError(error).message,
                toError(error),
            ),
            onError,
        )
        return
    }

    const signRequest: MessageSignRequest = {
        id: generateOrderedUniqueId(),
        type: 'message',
        message: messageRequest,
        transport: 'callback',
        sourceType: message.sourceType,
        transportId: message.connectionId,
        sourceMetadata: message.peer,
        verifiedOrigin: message.verifiedOrigin,
        approve: async signed => {
            await message.respond({
                type,
                signature: signed.signature.bytes,
            })
            forgetRequest(deps, message)
        },
        ...requestLifecycle(message, deps, () => signRequest),
    }
    addSignRequest(signRequest)
    trackRequest(deps, message, signRequest)
}

/**
 * use-wallet v5 dApps set the ARC-60 signer to the connected account's auth
 * address, which is never in `authorizedAccounts` itself, so the rekey hop is
 * accepted here; the pipeline's sign-in validation re-checks the binding.
 */
const isArc60AuthorizedSigner = (
    signer: string,
    authorizedAccounts: string[],
    accounts: WalletAccount[],
    scope: ChainScope,
): boolean =>
    authorizedAccounts.includes(signer) ||
    accounts.some(account => {
        const address = chainAccountOf(account, scope.chainId)?.address
        return (
            authorityOf(account, scope) === signer &&
            address !== undefined &&
            authorizedAccounts.includes(address)
        )
    })

// Auth-data deep validation (scope, domain binding, sign-in message) is not
// repeated here; the signing pipeline runs it for every request regardless of
// transport.
const enqueueArc60Request = (
    message: RequestMessage,
    payload: AuthDataSignableData,
    deps: EnqueueInboundRequestDeps,
): void => {
    const { accounts, onError } = deps
    const { authData, metadata } = payload
    const { signer } = authData

    if (
        !isArc60AuthorizedSigner(
            signer,
            message.authorizedAccounts,
            accounts,
            getSelectedScope(message.chainId),
        )
    ) {
        declineRequest(message, new Error('Invalid signer'), onError)
        return
    }

    const account = findAccountByAddressOn(accounts, message.chainId, signer)
    // Account-local: an ARC-60 signature verifies against the signer's own
    // key, so a keyless rekeyed signer is refused rather than signed for by
    // its auth account. Watch and multisig accounts fail it too.
    if (!account || !canSignMessage(message.chainId, account, 'authData')) {
        declineRequest(
            message,
            new Error('Signer cannot sign ARC-60 payloads'),
            onError,
        )
        return
    }

    enqueueDataSignRequest(
        message,
        { type: 'auth-data', authData, metadata },
        deps,
    )
}

// Chain id is out of scope: a v1 wire concept only the legacy v1 hook path
// checked per item, and nothing downstream of here reads `item.chainId`.
const legacyDataItemViolation = (
    chainId: ChainId,
    item: PeraArbitraryDataMessage,
    authorizedAccounts: string[],
    accounts: WalletAccount[],
): Error | null => {
    if (!authorizedAccounts.includes(item.signer)) {
        return new Error('Invalid signer')
    }
    const account = findAccountByAddressOn(accounts, chainId, item.signer)
    if (!account || !canSignMessage(chainId, account, 'arbitraryData')) {
        return new Error('Signer cannot sign arbitrary data')
    }
    if (!item.data) {
        return new Error('Data is missing')
    }
    return null
}

const enqueueLegacyDataRequest = (
    message: RequestMessage,
    items: PeraArbitraryDataMessage[],
    deps: EnqueueInboundRequestDeps,
): void => {
    const { accounts, onError } = deps
    if (items.length === 0) {
        declineRequest(message, new Error('Invalid data found'), onError)
        return
    }
    if (items.length > MAX_DATA_SIGN_REQUESTS) {
        declineRequest(
            message,
            new Error('Too many sign requests found'),
            onError,
        )
        return
    }
    for (const item of items) {
        const violation = legacyDataItemViolation(
            message.chainId,
            item,
            message.authorizedAccounts,
            accounts,
        )
        if (violation) {
            declineRequest(message, violation, onError)
            return
        }
    }

    enqueueDataSignRequest(
        message,
        { type: 'arbitrary-data', data: items },
        deps,
    )
}

// ARC-60 payloads are objects and the legacy shape is an array; Array.isArray is the whole discriminator.
const enqueueSignDataRequest = (
    message: RequestMessage,
    payload: AuthDataSignableData | PeraArbitraryDataMessage[],
    deps: EnqueueInboundRequestDeps,
): void => {
    if (Array.isArray(payload)) {
        enqueueLegacyDataRequest(message, payload, deps)
        return
    }
    enqueueArc60Request(message, payload, deps)
}

// The wallet builds the transaction from the dApp's request, so the user is
// shown the wallet's own priced transaction rather than the dApp's claim.
const enqueueSendTransactionRequest = (
    message: RequestMessage,
    request: unknown,
    deps: EnqueueInboundRequestDeps,
): void => {
    const { addSignRequest, onError } = deps
    const sending = dappRequestChainAdapters.get(
        message.chainId,
    ).sendTransaction
    if (!sending) {
        declineRequest(
            message,
            new Error(`${message.chainId} sends no transaction for a dApp`),
            onError,
        )
        return
    }

    trackRequest(deps, message, null)
    Promise.resolve()
        .then(() => sending.build(request))
        .then(
            transaction => {
                // An expiry or close while the chain built the transaction: the peer no longer takes an answer.
                if (
                    deps.pendingRequests.get(requestKey(message))?.isWithdrawn
                ) {
                    forgetRequest(deps, message)
                    return
                }
                const { submitSignedSend } = deps
                let isHandedOff = false
                // Once handed off, the receiver answers the peer; nothing here
                // may decline it again.
                const lifecycleMessage: RequestMessage = {
                    ...message,
                    reject: error =>
                        isHandedOff ? Promise.resolve() : message.reject(error),
                }
                const signRequest: UnsignedTransactionSignRequest = {
                    id: generateOrderedUniqueId(),
                    type: 'transactions',
                    // `network` routes an external source to the chain's
                    // broadcaster, which answers through `approve` once the
                    // transaction is submitted; `callback` only signs.
                    transport: submitSignedSend ? 'callback' : 'network',
                    sourceType: message.sourceType,
                    transportId: message.connectionId,
                    sourceMetadata: message.peer,
                    verifiedOrigin: message.verifiedOrigin,
                    txs: [transaction],
                    approve: submitSignedSend
                        ? async signed => {
                              const outcome = await submitSignedSend(
                                  signed.filter(
                                      (tx): tx is SignedTransaction => !!tx,
                                  ),
                              )
                              isHandedOff = true
                              forgetRequest(deps, message)
                              if (outcome.status === 'failed') {
                                  onError?.(outcome.error, {
                                      connectionId: message.connectionId,
                                  })
                              }
                          }
                        : async (_signed, submission) => {
                              const txId = submission?.txIds[0]
                              if (txId === undefined) {
                                  throw new Error(
                                      'The transaction was approved without being submitted',
                                  )
                              }
                              await message.respond({
                                  type: 'send-transaction',
                                  txId,
                              })
                              forgetRequest(deps, message)
                          },
                    ...requestLifecycle(
                        lifecycleMessage,
                        deps,
                        () => signRequest,
                    ),
                }
                addSignRequest(signRequest)
                settleTrackedRequest(deps, message, signRequest)
            },
            (error: unknown) => {
                forgetRequest(deps, message)
                declineRequest(message, toError(error), onError)
            },
        )
}

/**
 * A network-switch sheet held open for the user. `decision` is true only on
 * approve, and resolves false after `dismiss`.
 */
export type NetworkSwitchPrompt = {
    decision: Promise<boolean>
    dismiss: () => void
}

export type ConfirmNetworkSwitch = (request: {
    scope: ChainScope
    peer: ConnectionPeer
}) => NetworkSwitchPrompt

/**
 * Asks the user, then answers once they approve; the handler's `respond`
 * performs the switch, so a rejection from it is a failed switch, not a
 * success. An expiry or close while the sheet is open dismisses it and
 * answers nothing.
 */
const enqueueNetworkSwitch = (
    message: RequestMessage,
    networkId: NetworkId,
    deps: EnqueueInboundRequestDeps,
): void => {
    const { confirmNetworkSwitch, onError } = deps
    if (!confirmNetworkSwitch) {
        declineRequest(
            message,
            new ConnectionsError(
                'unsupported-operation',
                'This wallet cannot confirm a network switch here',
            ),
            onError,
        )
        return
    }

    let prompt: NetworkSwitchPrompt
    try {
        prompt = confirmNetworkSwitch({
            scope: { chainId: message.chainId, networkId },
            peer: message.peer,
        })
    } catch (error) {
        declineRequest(message, toError(error), onError)
        return
    }
    trackRequest(deps, message, null, prompt.dismiss)

    const isOpen = (): boolean => deps.pendingRequests.has(requestKey(message))
    prompt.decision.then(
        isApproved => {
            if (!isOpen()) return
            forgetRequest(deps, message)
            if (!isApproved) {
                rejectInBackground(message, new DappRequestRejectedError())
                return
            }
            message
                .respond({ type: 'switch-network' })
                .catch((error: unknown) =>
                    declineRequest(message, toError(error), onError),
                )
        },
        (error: unknown) => {
            if (!isOpen()) return
            forgetRequest(deps, message)
            declineRequest(message, toError(error), onError)
        },
    )
}

export type EnqueueInboundRequestDeps = {
    transactionSigning: ChainTransactionSigning
    addSignRequest: (request: SignRequest) => void
    removeSignRequest: (request: SignRequest) => void
    /** Read live: requests arrive in bursts between renders. */
    isSignRequestPending: (id: string) => boolean
    isSignRequestPastApproval: (id: string) => boolean
    accounts: WalletAccount[]
    /**
     * Every request still open for the user, so a `request-expired` message
     * can withdraw the right one. One ledger per adapter instance.
     */
    pendingRequests: PendingRequestLedger
    /**
     * Without one a refused or undeliverable request closes the sheet with no
     * explanation. The registry's emitter on mobile; the approval window
     * passes its own surface.
     */
    onError?: ConnectionErrorReporter
    /** Without one a network switch is declined. */
    confirmNetworkSwitch?: ConfirmNetworkSwitch
    /**
     * Set by a surface that must not broadcast (the extension's approval
     * window): the signed send goes here, and the receiver broadcasts it and
     * answers the peer. Resolves with the receiver's outcome; a rejection
     * means no outcome came back, so this surface still answers the peer, and
     * a receiver that did take the send ignores that late answer.
     */
    submitSignedSend?: (
        signed: SignedTransaction[],
    ) => Promise<SignedSendOutcome>
}

export type SignedSendOutcome =
    | { status: 'submitted'; txId: string }
    | { status: 'failed'; error: Error }

/**
 * Pure over its deps so the browser's approval window, which has no hook realm,
 * can call it directly. The handler declares the message's `sourceType`, so a
 * new transport reaches the pipeline without this adapter knowing it exists.
 */
export const enqueueInboundRequest = (
    message: InboundMessage,
    deps: EnqueueInboundRequestDeps,
): void => {
    if (message.kind === 'request-expired') {
        withdrawExpiredRequest(message, deps)
        return
    }
    if (message.kind === 'connection-closed') {
        withdrawClosedConnection(message.connectionId, deps)
        return
    }
    if (message.kind !== 'request') return

    const breach = pendingCapacityBreach(
        openRequestConnections(deps),
        message.connectionId,
    )
    if (breach) {
        // Not toasted: a peer flooding requests would flood the user too.
        logger.warn('[connections] refused a request over the pending cap', {
            connectionId: message.connectionId,
            breach,
        })
        rejectInBackground(message, new PendingRequestCapacityError())
        return
    }

    if (message.operation.type === 'sign-transactions') {
        // `useChainTransactionSigning` resolves one chain's hook per mount, so
        // a message naming any other chain finds no enqueue and is declined.
        const enqueue = deps.transactionSigning.get(message.chainId)
        if (!enqueue) {
            declineRequest(
                message,
                new Error(
                    `No signing adapter mounted for chain ${message.chainId}`,
                ),
                deps.onError,
            )
            return
        }

        // Tracked before the enqueue, which resolves and then awaits the fee
        // calculator: an expiry can land in between, and the resolve step
        // itself can throw synchronously (an escaped throw would kill the
        // registry's listener loop, so answer the peer here instead).
        trackRequest(deps, message, null)
        let enqueued: ReturnType<EnqueueTransactionSigning>
        try {
            enqueued = enqueue(
                {
                    group: message.operation.group,
                    authorizedAccounts: message.authorizedAccounts,
                },
                {
                    sourceType: message.sourceType,
                    transportId: message.connectionId,
                    // Serializable id so a multisig sync-flow handoff can
                    // answer this exact request after an app kill.
                    payloadId: handoffPayloadId(message.correlationId),
                    sourceMetadata: message.peer,
                    verifiedOrigin: message.verifiedOrigin,
                    // A failed delivery must propagate: it is how a
                    // dead-socket revival surfaces as retryable rather than
                    // as a fake success.
                    respondWithResult: async signed => {
                        await message.respond({
                            type: 'sign-transactions',
                            signed,
                        })
                        forgetRequest(deps, message)
                    },
                    respondWithReject: () => {
                        forgetRequest(deps, message)
                        rejectInBackground(
                            message,
                            new DappRequestRejectedError(),
                        )
                    },
                    respondWithSoftReject: async error => {
                        await message.reject(error)
                        forgetRequest(deps, message)
                    },
                    respondWithError: error => {
                        const isAnswered = failRequest(
                            message,
                            error,
                            deps.onError,
                        )
                        if (isAnswered) forgetRequest(deps, message)
                        return isAnswered
                    },
                },
            )
        } catch (error) {
            forgetRequest(deps, message)
            declineRequest(message, toError(error), deps.onError)
            return
        }
        // `enqueue` can still reject past its own handling (re-encoding a
        // fee-adjusted group); un-caught that is an unanswered peer.
        enqueued.then(
            request => settleTrackedRequest(deps, message, request ?? null),
            (error: unknown) => {
                forgetRequest(deps, message)
                declineRequest(message, toError(error), deps.onError)
            },
        )
        return
    }

    if (message.operation.type === 'send-transaction') {
        enqueueSendTransactionRequest(message, message.operation.request, deps)
        return
    }

    if (message.operation.type === 'switch-network') {
        enqueueNetworkSwitch(message, message.operation.networkId, deps)
        return
    }

    // The operation union is closed; the only remaining case is 'sign-data'.
    if (message.operation.type !== 'sign-data') {
        enqueueMessageRequest(
            message,
            message.operation.type,
            message.operation.request,
            deps,
        )
        return
    }

    enqueueSignDataRequest(message, message.operation.payload, deps)
}

/**
 * Resolves the chain's own `useEnqueueTransactionSigning` hook and memoises
 * the result with the chain id it answers for. Mirrors the onramp
 * `useEnsureRampDestination` pattern: the adapter's hook runs as part of this
 * one, so a caller switching `chainId` between renders changes the hook
 * order underneath it and must remount rather than re-render.
 */
export const useChainTransactionSigning = (
    chainId: ChainId,
): ChainTransactionSigning => {
    const useEnqueue =
        dappRequestChainAdapters.get(chainId).useEnqueueTransactionSigning
    const enqueue = useEnqueue()
    return useMemo<ChainTransactionSigning>(
        () => new Map([[chainId, enqueue]]),
        [chainId, enqueue],
    )
}

export type UseConnectionSigningAdapterOptions = {
    confirmNetworkSwitch?: ConfirmNetworkSwitch
}

/** Every handler normalises into `InboundMessage`, so a new connection kind needs no change here. */
export const useConnectionSigningAdapter = (
    registry: ConnectionRegistry,
    chainId: ChainId,
    options?: UseConnectionSigningAdapterOptions,
): void => {
    const confirmNetworkSwitch = options?.confirmNetworkSwitch
    const transactionSigning = useChainTransactionSigning(chainId)
    const { addSignRequest, removeSignRequest } = useSigningRequest()
    const accounts = useAllAccounts()

    // The registry's own channel, so a WalletConnect failure raises the same
    // toast the handler's errors do.
    const onError: ConnectionErrorReporter = (error, scope) =>
        registry.reportError(error, scope)

    const pendingRequestsRef = useRef<PendingRequestLedger>(new Map())
    const depsRef = useRef<EnqueueInboundRequestDeps>({
        transactionSigning,
        addSignRequest,
        removeSignRequest,
        isSignRequestPending,
        isSignRequestPastApproval,
        accounts,
        pendingRequests: pendingRequestsRef.current,
        onError,
        confirmNetworkSwitch,
    })
    depsRef.current = {
        transactionSigning,
        addSignRequest,
        removeSignRequest,
        isSignRequestPending,
        isSignRequestPastApproval,
        accounts,
        pendingRequests: pendingRequestsRef.current,
        onError,
        confirmNetworkSwitch,
    }

    useEffect(
        () =>
            registry.subscribeToMessages(message =>
                enqueueInboundRequest(message, depsRef.current),
            ),
        [registry],
    )
}
