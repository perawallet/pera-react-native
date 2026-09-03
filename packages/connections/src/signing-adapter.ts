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
    logger,
    toError,
} from '@perawallet/wallet-core-shared'
import {
    MAX_DATA_SIGN_REQUESTS,
    useArc0001Resolver,
    useEnqueueArc0001SignRequest,
    useSigningRequest,
    type Arc60SignRequest,
    type Arc60SignableData,
    type ArbitraryDataSignRequest,
    type PeraArbitraryDataMessage,
    type PeraArbitraryDataSignResult,
    type RejectReason,
    type SignRequest,
} from '@perawallet/wallet-core-signing'
import {
    canSignArbitraryData,
    canSignArc60,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { InboundMessage } from './models'
import type { ConnectionRegistry } from './registry'

type RequestMessage = Extract<InboundMessage, { kind: 'request' }>

/**
 * Answer the peer with a rejection, swallowing a failed DELIVERY — loudly.
 *
 * `respondWithReject` and `respondWithError` are typed by the transport
 * contract as returning `void`, so there is nowhere to propagate a delivery
 * failure to; leaving the promise un-caught escapes to the platform's global
 * handler instead, which on React Native is a red box. This mirrors the v1
 * path's `deliverRejectInBackground`: the dApp then times out on its own side,
 * exactly as it would have when the response was queued into a dead socket.
 *
 * `respondWithResult` and `respondWithSoftReject` deliberately do NOT go
 * through here — they return the promise to the pipeline, which is how a
 * failed dead-socket revival surfaces as a retryable failure.
 *
 * `reject` is handler-supplied transport code, and the contract only promises
 * a `Promise`. Today's v1 implementation is `async` and so cannot throw before
 * its first `await`, but a handler whose `reject` is a plain function may — and
 * this runs inside the handler's own socket listener, where an escaping throw
 * takes the listener down. The enclosing `try` is that containment, matching
 * `registry.ts`'s validation-failure path.
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
 * Whether `signer` is one this connection may use — directly, or as the
 * rekeyAddress of an approved account. The rekey hop matters only for ARC-60:
 * use-wallet v5 dApps resolve the signer to the connected account's auth
 * address themselves, which is never in `authorizedAccounts` directly (the
 * SESSION was approved for the rekeyed account, not its auth account). The
 * SIWA validation downstream (`validateArc60AuthRequest`, run by the signing
 * pipeline itself, not here) re-checks the rekey binding against the payload.
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

/**
 * Enqueues an ARC-60 `algo_signData` request. Mirrors
 * `handleArc60SignData`/`validateArc60Request` in
 * `packages/walletconnect/src/hooks/useWalletConnectHandlers.ts` — see that
 * file for the checks preserved here (signer membership, `canSignArc60`).
 * ARC-60's own deep validation (scope, domain binding, SIWA parse) is NOT
 * repeated here: it already runs inside the signing pipeline itself
 * (`useLocalKeyArc60Signer`, `createHardwareStrategy`), for every ARC-60
 * request regardless of transport.
 */
const enqueueArc60Request = (
    message: RequestMessage,
    payload: Arc60SignableData,
    accounts: WalletAccount[],
    addSignRequest: (request: SignRequest) => void,
    removeSignRequest: (request: SignRequest) => void,
): void => {
    const { stdSigData, metadata } = payload
    const { signer } = stdSigData

    if (
        !isArc60AuthorizedSigner(signer, message.authorizedAccounts, accounts)
    ) {
        rejectInBackground(message, new Error('Invalid signer'))
        return
    }

    const account = accounts.find(a => a.address === signer)
    // canSignArc60 covers both ARC-60 signing paths (local-key and hardware)
    // and resolves a rekeyed signer to its auth account. Watch and multisig
    // accounts can do neither, so they're rejected here.
    if (!account || !canSignArc60(account, accounts)) {
        rejectInBackground(
            message,
            new Error('Signer cannot sign ARC-60 payloads'),
        )
        return
    }

    const signRequest: Arc60SignRequest = {
        id: generateOrderedUniqueId(),
        type: 'arc60',
        transport: 'callback',
        // See the doc comment on `useConnectionSigningAdapter` for why this
        // stays hardcoded rather than reading a per-message source type.
        sourceType: 'walletconnect',
        transportId: message.connectionId,
        // Approved-snapshot identity carried on the message — the
        // anti-spoofing dApp identity shown on the signing sheet.
        sourceMetadata: message.peer,
        stdSigData,
        metadata,
        approve: async (signed: PeraArbitraryDataSignResult[]) => {
            // `respond` rejects when the peer could not be reached — that
            // rejection MUST propagate, exactly like sign-transactions'
            // `respondWithResult`.
            await message.respond({
                type: 'sign-data',
                signatures: signed.map(item => item.signature),
            })
        },
        reject: async (reason: RejectReason = { kind: 'user' }) => {
            if (reason.kind === 'softReject') {
                await message.reject(reason.error)
                removeSignRequest(signRequest)
                return
            }
            rejectInBackground(message, new Error('User rejected'))
        },
        error: async (error: Error) => {
            rejectInBackground(message, error)
            removeSignRequest(signRequest)
        },
    }
    addSignRequest(signRequest)
}

/**
 * Validates one legacy `PeraArbitraryDataMessage` item — mirrors the
 * per-item checks in `validateDataSignRequest` (chain id is out of scope
 * here; it's a v1 wire concept the v1 handler already checked before this
 * message reached the neutral layer). Returns the first violation found, or
 * `null` if the item is signable.
 */
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

/**
 * Enqueues a legacy (array) `algo_signData` request. Mirrors
 * `handleSignData`/`validateDataSignRequest` in
 * `packages/walletconnect/src/hooks/useWalletConnectHandlers.ts`.
 */
const enqueueLegacyDataRequest = (
    message: RequestMessage,
    items: PeraArbitraryDataMessage[],
    accounts: WalletAccount[],
    addSignRequest: (request: SignRequest) => void,
    removeSignRequest: (request: SignRequest) => void,
): void => {
    if (items.length === 0) {
        rejectInBackground(message, new Error('Invalid data found'))
        return
    }
    if (items.length > MAX_DATA_SIGN_REQUESTS) {
        rejectInBackground(message, new Error('Too many sign requests found'))
        return
    }
    for (const item of items) {
        const violation = legacyDataItemViolation(
            item,
            message.authorizedAccounts,
            accounts,
        )
        if (violation) {
            rejectInBackground(message, violation)
            return
        }
    }

    const signRequest: ArbitraryDataSignRequest = {
        id: generateOrderedUniqueId(),
        type: 'arbitrary-data',
        transport: 'callback',
        sourceType: 'walletconnect',
        transportId: message.connectionId,
        // Approved-snapshot identity carried on the message — the
        // anti-spoofing dApp identity shown on the signing sheet.
        sourceMetadata: message.peer,
        data: items,
        approve: async (signed: PeraArbitraryDataSignResult[]) => {
            await message.respond({
                type: 'sign-data',
                signatures: signed.map(item => item.signature),
            })
        },
        reject: async (reason: RejectReason = { kind: 'user' }) => {
            if (reason.kind === 'softReject') {
                await message.reject(reason.error)
                removeSignRequest(signRequest)
                return
            }
            rejectInBackground(message, new Error('User rejected'))
        },
        error: async (error: Error) => {
            rejectInBackground(message, error)
            removeSignRequest(signRequest)
        },
    }
    addSignRequest(signRequest)
}

/**
 * ARC-60 and the legacy shape are structurally disjoint (an object vs an
 * array) — `validateRawMessage` (`validate.ts`) already relies on this same
 * split to keep each schema's field-path breadcrumb intact, so discriminating
 * on `Array.isArray` here needs no further heuristics.
 */
const enqueueSignDataRequest = (
    message: RequestMessage,
    payload: Arc60SignableData | PeraArbitraryDataMessage[],
    accounts: WalletAccount[],
    addSignRequest: (request: SignRequest) => void,
    removeSignRequest: (request: SignRequest) => void,
): void => {
    if (Array.isArray(payload)) {
        enqueueLegacyDataRequest(
            message,
            payload,
            accounts,
            addSignRequest,
            removeSignRequest,
        )
        return
    }
    enqueueArc60Request(
        message,
        payload,
        accounts,
        addSignRequest,
        removeSignRequest,
    )
}

/**
 * The single bridge between any connection handler and the signing pipeline:
 * every handler normalises its protocol into {@link InboundMessage}, and only
 * this adapter knows how to turn one into a sign request. A third
 * WalletConnect-family connection kind needs no change here.
 *
 * `sourceType` below is hardcoded to `'walletconnect'` because both handlers
 * in this plan are WalletConnect, and that's what keeps
 * `isInteractiveSource`/`isExternalCallbackSource` membership,
 * `SignRequestView`'s walletconnect branch, analytics labels, and the
 * multisig handoff's `source.type` unchanged. A genuinely different
 * transport would need its own `SourceType`; the intended shape for that is
 * the handler declaring `sourceType` on the message itself, not this adapter
 * hardcoding one.
 */
export const useConnectionSigningAdapter = (
    registry: ConnectionRegistry,
): void => {
    const resolveArc0001 = useArc0001Resolver()
    const enqueue = useEnqueueArc0001SignRequest()
    const { addSignRequest, removeSignRequest } = useSigningRequest()
    const accounts = useAllAccounts()

    const resolveRef = useRef(resolveArc0001)
    resolveRef.current = resolveArc0001
    const enqueueRef = useRef(enqueue)
    enqueueRef.current = enqueue
    const addSignRequestRef = useRef(addSignRequest)
    addSignRequestRef.current = addSignRequest
    const removeSignRequestRef = useRef(removeSignRequest)
    removeSignRequestRef.current = removeSignRequest
    const accountsRef = useRef(accounts)
    accountsRef.current = accounts

    useEffect(() => {
        const handle = (message: InboundMessage): void => {
            if (message.kind !== 'request') return

            if (message.operation.type === 'sign-transactions') {
                // `authorizedAddresses` binds this connection to the accounts
                // it was approved for — it is what stops a session approved
                // for account A from signing for account B. It comes from the
                // message rather than a store lookup so it cannot race a
                // concurrent disconnect, and cannot be forgotten.
                //
                // The resolver enforces that binding by THROWING, and it
                // throws on every other ARC-0001 violation too. Nothing
                // downstream answers the peer for us: an escaped throw dies
                // in the registry's listener loop as a log line, so the dApp
                // would wait out its own timeout and the user would see
                // nothing — least of all on the unauthorized-signer path.
                let resolved: ReturnType<typeof resolveArc0001>
                try {
                    resolved = resolveRef.current(
                        { transactions: message.operation.group },
                        {
                            authorizedAddresses: new Set(
                                message.authorizedAccounts,
                            ),
                        },
                    )
                } catch (error) {
                    rejectInBackground(message, toError(error))
                    return
                }

                // `enqueue` can still reject past its own internal error
                // handling (re-encoding a fee-adjusted group, `addSignRequest`
                // itself). Un-caught that is both an unhandled rejection and
                // an unanswered peer, so it lands on the same reject path.
                enqueueRef
                    .current(resolved, {
                        sourceType: 'walletconnect',
                        transportId: message.connectionId,
                        // Approved-snapshot identity carried on the message —
                        // the anti-spoofing dApp identity shown on the signing
                        // sheet.
                        sourceMetadata: message.peer,
                        // `respond` rejects when the peer could not be reached.
                        // That rejection MUST propagate: it is how WalletConnect
                        // v1's dead-socket revival surfaces as a retryable
                        // failure rather than a fake success.
                        respondWithResult: signed =>
                            message.respond({
                                type: 'sign-transactions',
                                signed,
                            }),
                        respondWithReject: () =>
                            rejectInBackground(
                                message,
                                new Error('User rejected'),
                            ),
                        respondWithSoftReject: error => message.reject(error),
                        respondWithError: error =>
                            rejectInBackground(message, error),
                    })
                    .catch((error: unknown) => {
                        rejectInBackground(message, toError(error))
                    })
                return
            }

            // The union is closed (`WALLET_OPERATION_TYPES`), so this is the
            // only remaining case: 'sign-data'.
            enqueueSignDataRequest(
                message,
                message.operation.payload,
                accountsRef.current,
                addSignRequestRef.current,
                removeSignRequestRef.current,
            )
        }

        return registry.subscribeToMessages(handle)
    }, [registry])
}
