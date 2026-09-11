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

import { useEffect, useRef } from 'react'
import {
    generateOrderedUniqueId,
    isRetryableError,
    logger,
    toError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    MAX_DATA_SIGN_REQUESTS,
    isFeeAdjustmentDeliveryError,
    useArc0001Resolver,
    useEnqueueArc0001SignRequest,
    useSigningRequest,
    type Arc60SignRequest,
    type Arc60SignableData,
    type ArbitraryDataSignRequest,
    type EnqueueArc0001SignRequest,
    type PeraArbitraryDataMessage,
    type PeraArbitraryDataSignResult,
    type RejectReason,
    type SignRequest,
    type UseArc0001ResolverResult,
} from '@perawallet/wallet-core-signing'
import {
    canSignArbitraryData,
    canSignArc60,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ConnectionErrorScope, InboundMessage } from './models'
import type { ConnectionRegistry } from './registry'

type RequestMessage = Extract<InboundMessage, { kind: 'request' }>
type ExpiredMessage = Extract<InboundMessage, { kind: 'request-expired' }>

/**
 * One request the pipeline is holding open for the user. `withdraw` is null
 * while the ARC-0001 enqueue is still resolving fees; an expiry landing in
 * that window marks the entry and the enqueue's continuation withdraws.
 */
type PendingRequest = { withdraw: Nullable<() => void>; isExpired: boolean }

export type PendingRequestLedger = Map<string, PendingRequest>

const requestKey = (message: {
    connectionId: string
    correlationId: string
}): string => `${message.connectionId}\u0000${message.correlationId}`

const trackRequest = (
    deps: EnqueueInboundRequestDeps,
    message: RequestMessage,
    withdraw: Nullable<() => void>,
): void => {
    deps.pendingRequests.set(requestKey(message), {
        withdraw,
        isExpired: false,
    })
}

const forgetRequest = (
    deps: EnqueueInboundRequestDeps,
    message: RequestMessage,
): void => {
    deps.pendingRequests.delete(requestKey(message))
}

/** The async enqueue settled: hand over the withdrawal, or honour an expiry that beat it. */
const settleTrackedRequest = (
    deps: EnqueueInboundRequestDeps,
    message: RequestMessage,
    withdraw: Nullable<() => void>,
): void => {
    const key = requestKey(message)
    const entry = deps.pendingRequests.get(key)
    if (!withdraw || !entry) {
        deps.pendingRequests.delete(key)
        return
    }
    if (entry.isExpired) {
        deps.pendingRequests.delete(key)
        withdraw()
        return
    }
    entry.withdraw = withdraw
}

// Not reported here: the handler that saw the expiry owns the user-facing
// error. An unknown key is a request already answered or refused.
const withdrawExpiredRequest = (
    message: ExpiredMessage,
    deps: EnqueueInboundRequestDeps,
): void => {
    const key = requestKey(message)
    const entry = deps.pendingRequests.get(key)
    if (!entry) return
    if (!entry.withdraw) {
        entry.isExpired = true
        return
    }
    deps.pendingRequests.delete(key)
    entry.withdraw()
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

/**
 * use-wallet v5 dApps set the ARC-60 signer to the connected account's auth
 * address, which is never in `authorizedAccounts` itself, so the rekey hop is
 * accepted here; the pipeline's SIWA validation re-checks the binding.
 */
const isArc60AuthorizedSigner = (
    signer: string,
    authorizedAccounts: string[],
    accounts: WalletAccount[],
): boolean =>
    authorizedAccounts.includes(signer) ||
    accounts.some(
        account =>
            account.rekeyAddress === signer &&
            authorizedAccounts.includes(account.address),
    )

// ARC-60 deep validation (scope, domain binding, SIWA) is not repeated here;
// the signing pipeline runs it for every ARC-60 request regardless of transport.
const enqueueArc60Request = (
    message: RequestMessage,
    payload: Arc60SignableData,
    deps: EnqueueInboundRequestDeps,
): void => {
    const { accounts, addSignRequest, removeSignRequest, onError } = deps
    const { stdSigData, metadata } = payload
    const { signer } = stdSigData

    if (
        !isArc60AuthorizedSigner(signer, message.authorizedAccounts, accounts)
    ) {
        declineRequest(message, new Error('Invalid signer'), onError)
        return
    }

    const account = accounts.find(a => a.address === signer)
    // Account-local: an ARC-60 signature verifies against the signer's own
    // key, so a keyless rekeyed signer is refused rather than signed for by
    // its auth account. Watch and multisig accounts fail it too.
    if (!account || !canSignArc60(account)) {
        declineRequest(
            message,
            new Error('Signer cannot sign ARC-60 payloads'),
            onError,
        )
        return
    }

    const signRequest: Arc60SignRequest = {
        id: generateOrderedUniqueId(),
        type: 'arc60',
        transport: 'callback',
        sourceType: message.sourceType,
        transportId: message.connectionId,
        sourceMetadata: message.peer,
        stdSigData,
        metadata,
        approve: async (signed: PeraArbitraryDataSignResult[]) => {
            await message.respond({
                type: 'sign-data',
                signatures: signed.map(item => item.signature),
            })
            forgetRequest(deps, message)
        },
        reject: async (reason: RejectReason = { kind: 'user' }) => {
            forgetRequest(deps, message)
            if (reason.kind === 'softReject') {
                await message.reject(reason.error)
                removeSignRequest(signRequest)
                return
            }
            rejectInBackground(message, new Error('User rejected'))
        },
        error: async (error: Error) => {
            if (failRequest(message, error, onError)) {
                forgetRequest(deps, message)
                removeSignRequest(signRequest)
            }
        },
    }
    addSignRequest(signRequest)
    trackRequest(deps, message, () => removeSignRequest(signRequest))
}

// Chain id is out of scope: a v1 wire concept only the legacy v1 hook path
// checked per item, and nothing downstream of here reads `item.chainId`.
const legacyDataItemViolation = (
    item: PeraArbitraryDataMessage,
    authorizedAccounts: string[],
    accounts: WalletAccount[],
): Error | null => {
    if (!authorizedAccounts.includes(item.signer)) {
        return new Error('Invalid signer')
    }
    const account = accounts.find(a => a.address === item.signer)
    if (!account || !canSignArbitraryData(account)) {
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
    const { accounts, addSignRequest, removeSignRequest, onError } = deps
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
            item,
            message.authorizedAccounts,
            accounts,
        )
        if (violation) {
            declineRequest(message, violation, onError)
            return
        }
    }

    const signRequest: ArbitraryDataSignRequest = {
        id: generateOrderedUniqueId(),
        type: 'arbitrary-data',
        transport: 'callback',
        sourceType: message.sourceType,
        transportId: message.connectionId,
        sourceMetadata: message.peer,
        data: items,
        approve: async (signed: PeraArbitraryDataSignResult[]) => {
            await message.respond({
                type: 'sign-data',
                signatures: signed.map(item => item.signature),
            })
            forgetRequest(deps, message)
        },
        reject: async (reason: RejectReason = { kind: 'user' }) => {
            forgetRequest(deps, message)
            if (reason.kind === 'softReject') {
                await message.reject(reason.error)
                removeSignRequest(signRequest)
                return
            }
            rejectInBackground(message, new Error('User rejected'))
        },
        error: async (error: Error) => {
            if (failRequest(message, error, onError)) {
                forgetRequest(deps, message)
                removeSignRequest(signRequest)
            }
        },
    }
    addSignRequest(signRequest)
    trackRequest(deps, message, () => removeSignRequest(signRequest))
}

// ARC-60 payloads are objects and the legacy shape is an array; Array.isArray is the whole discriminator.
const enqueueSignDataRequest = (
    message: RequestMessage,
    payload: Arc60SignableData | PeraArbitraryDataMessage[],
    deps: EnqueueInboundRequestDeps,
): void => {
    if (Array.isArray(payload)) {
        enqueueLegacyDataRequest(message, payload, deps)
        return
    }
    enqueueArc60Request(message, payload, deps)
}

export type EnqueueInboundRequestDeps = {
    resolveArc0001: UseArc0001ResolverResult
    enqueueArc0001: EnqueueArc0001SignRequest
    addSignRequest: (request: SignRequest) => void
    removeSignRequest: (request: SignRequest) => void
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
}

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
    if (message.kind !== 'request') return

    if (message.operation.type === 'sign-transactions') {
        // The resolver enforces `authorizedAddresses` by throwing; an escaped
        // throw would kill the registry's listener loop, so answer the peer here.
        let resolved: ReturnType<UseArc0001ResolverResult>
        try {
            resolved = deps.resolveArc0001(
                { transactions: message.operation.group },
                {
                    authorizedAddresses: new Set(message.authorizedAccounts),
                },
            )
        } catch (error) {
            declineRequest(message, toError(error), deps.onError)
            return
        }

        // Tracked before the enqueue, which awaits the fee calculator: an
        // expiry can land in between.
        trackRequest(deps, message, null)
        // `enqueue` can still reject past its own handling (re-encoding a
        // fee-adjusted group); un-caught that is an unanswered peer.
        deps.enqueueArc0001(resolved, {
            sourceType: message.sourceType,
            transportId: message.connectionId,
            // Serializable id so a multisig sync-flow handoff can answer this
            // exact request after an app kill.
            payloadId: handoffPayloadId(message.correlationId),
            sourceMetadata: message.peer,
            // A failed delivery must propagate: it is how a dead-socket revival
            // surfaces as retryable rather than as a fake success.
            respondWithResult: async signed => {
                await message.respond({ type: 'sign-transactions', signed })
                forgetRequest(deps, message)
            },
            respondWithReject: () => {
                forgetRequest(deps, message)
                rejectInBackground(message, new Error('User rejected'))
            },
            respondWithSoftReject: async error => {
                await message.reject(error)
                forgetRequest(deps, message)
            },
            respondWithError: error => {
                if (failRequest(message, error, deps.onError)) {
                    forgetRequest(deps, message)
                }
            },
        }).then(
            request =>
                settleTrackedRequest(
                    deps,
                    message,
                    request ? () => deps.removeSignRequest(request) : null,
                ),
            (error: unknown) => {
                forgetRequest(deps, message)
                declineRequest(message, toError(error), deps.onError)
            },
        )
        return
    }

    // The operation union is closed; the only remaining case is 'sign-data'.
    enqueueSignDataRequest(message, message.operation.payload, deps)
}

/** Every handler normalises into `InboundMessage`, so a new connection kind needs no change here. */
export const useConnectionSigningAdapter = (
    registry: ConnectionRegistry,
): void => {
    const resolveArc0001 = useArc0001Resolver()
    const enqueueArc0001 = useEnqueueArc0001SignRequest()
    const { addSignRequest, removeSignRequest } = useSigningRequest()
    const accounts = useAllAccounts()

    // The registry's own channel, so a WalletConnect failure raises the same
    // toast the handler's errors do.
    const onError: ConnectionErrorReporter = (error, scope) =>
        registry.reportError(error, scope)

    const pendingRequestsRef = useRef<PendingRequestLedger>(new Map())
    const depsRef = useRef<EnqueueInboundRequestDeps>({
        resolveArc0001,
        enqueueArc0001,
        addSignRequest,
        removeSignRequest,
        accounts,
        pendingRequests: pendingRequestsRef.current,
        onError,
    })
    depsRef.current = {
        resolveArc0001,
        enqueueArc0001,
        addSignRequest,
        removeSignRequest,
        accounts,
        pendingRequests: pendingRequestsRef.current,
        onError,
    }

    useEffect(
        () =>
            registry.subscribeToMessages(message =>
                enqueueInboundRequest(message, depsRef.current),
            ),
        [registry],
    )
}
