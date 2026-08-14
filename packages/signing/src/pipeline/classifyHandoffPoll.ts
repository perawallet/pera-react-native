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
    assembleSignedMultisigTransactions,
    rawTransactionsMatch,
    type ParticipantResponse,
} from '@perawallet/wallet-core-blockchain'
import {
    logger,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { buildWalletConnectSignResult } from '../utils/buildWalletConnectSignResult'
import {
    walletConnectHandoffs,
    type PendingWalletConnectHandoff,
} from './walletConnectHandoffs'

/**
 * Mirrors a subset of multisig's `HandoffPollDetail`, redeclared structurally to
 * keep the type dependency one-way (multisig -> signing).
 */
export type HandoffPollDetail = {
    id?: string
    status: string
    fail_reason_display: string | null
    transaction_lists: Array<{
        raw_transactions: string[]
        responses: Array<{
            address: string
            response: string
            signatures?: (string | null)[] | null
        }>
    }>
}

/** Built by the resolver hook so these functions stay plain and unit-testable. */
export type ResolverMessages = {
    declined: string
    expired: string
    failed: string
    noTransactions: string
    deliveryFailed: string
    assemblyFailed: (reason: string) => string
}

/** Why a handoff poll ended in a terminal failure (non-fatal to the app). */
export type HandoffErrorReason =
    | { kind: 'no-transactions' }
    | { kind: 'assembly-failed'; detail: string }
    | { kind: 'backend-failed'; displayReason: string | null }
    | { kind: 'session-disconnected' }

/** Every variant but `keep-polling` is terminal, delivered exactly once. */
export type HandoffPollOutcome =
    | { kind: 'keep-polling' }
    | { kind: 'ready'; assembledBytes: Uint8Array[] }
    | { kind: 'soft-reject'; reason: 'declined' | 'expired' }
    | { kind: 'error'; reason: HandoffErrorReason }

/** Terminal outcomes — everything `classifyHandoffPoll` returns but `keep-polling`. */
export type TerminalHandoffOutcome = Exclude<
    HandoffPollOutcome,
    { kind: 'keep-polling' }
>

/**
 * Narrower than {@link PendingWalletConnectHandoff} so non-WC consumers can
 * reuse the classification logic without fabricating WC-only fields.
 */
export type HandoffAssemblyContext = {
    multisigAddress: string
    msigMetadata: { version: number; threshold: number; addresses: string[] }
    expectedRawTransactionsBase64: string[]
}

/**
 * `keep-polling` covers non-terminal statuses AND a `ready`/`confirmed` request
 * whose signature payloads haven't all serialized yet — the backend can flip
 * status before every signature lands, so the next poll catches up.
 */
export const classifyHandoffPoll = async (
    detail: HandoffPollDetail,
    handoff: HandoffAssemblyContext,
): Promise<HandoffPollOutcome> => {
    switch (detail.status) {
        case 'ready':
        case 'confirmed': {
            return classifyReadyPoll(detail, handoff)
        }
        case 'declined': {
            return { kind: 'soft-reject', reason: 'declined' }
        }
        case 'expired': {
            return { kind: 'soft-reject', reason: 'expired' }
        }
        case 'failed': {
            return {
                kind: 'error',
                reason: {
                    kind: 'backend-failed',
                    displayReason: detail.fail_reason_display,
                },
            }
        }
        default: {
            // 'pending' / 'submitting' — keep polling.
            return { kind: 'keep-polling' }
        }
    }
}

const classifyReadyPoll = async (
    detail: HandoffPollDetail,
    handoff: HandoffAssemblyContext,
): Promise<HandoffPollOutcome> => {
    const lists = detail.transaction_lists

    // Race-condition guard: the backend can flip status to 'ready' before
    // every signature payload is serialized in the response. A 'signed'
    // participant with no signatures at all is the cheap-to-detect case —
    // short-circuit before paying for Ed25519 verifies. A *partially* written
    // payload is caught below: assembly reports it as 'insufficient-signatures'
    // and we keep polling for that too.
    for (const list of lists) {
        for (const response of list.responses) {
            if (response.response !== 'signed') continue
            if (!response.signatures || response.signatures.length === 0) {
                return { kind: 'keep-polling' }
            }
        }
    }

    if (lists.length === 0) {
        return { kind: 'error', reason: { kind: 'no-transactions' } }
    }

    // Trust anchor: the returned bytes must be exactly what the wallet proposed
    // — what the user reviewed and the proposer signed — so a compromised
    // backend can't substitute transactions.
    const polledRawTransactions = lists.flatMap(list => list.raw_transactions)
    if (
        !rawTransactionsMatch(
            handoff.expectedRawTransactionsBase64,
            polledRawTransactions,
        )
    ) {
        return {
            kind: 'error',
            reason: {
                kind: 'assembly-failed',
                detail: 'transactions returned by the backend do not match the proposed transactions',
            },
        }
    }

    // Assemble one composite SignedTransaction per item, in canonical order:
    // by list, then by position within the list.
    const assembledBytes: Uint8Array[] = []
    for (const list of lists) {
        const result = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: list.raw_transactions,
            participantAddresses: handoff.msigMetadata.addresses,
            version: handoff.msigMetadata.version,
            threshold: handoff.msigMetadata.threshold,
            multisigAddress: handoff.multisigAddress,
            // The structural `HandoffPollDetail.response` is `string` to
            // avoid a hard coupling on the multisig schema; the multisig
            // backend only ever emits `'signed' | 'declined'`, so the cast
            // is safe at this trust boundary.
            responses: list.responses.map(response => ({
                address: response.address,
                response: response.response,
                signatures: response.signatures ?? undefined,
            })) as ParticipantResponse[],
        })
        // Mid-write race: 'ready' flipped before every signature serialized, so
        // some index is still below threshold. Not terminal — the next poll
        // catches up, and the resolver's deadline self-expires a request that
        // never completes. Hard errors (bad bytes, failed verification) stay
        // terminal below.
        if (result.kind === 'insufficient-signatures') {
            return { kind: 'keep-polling' }
        }
        if (result.kind === 'error') {
            return {
                kind: 'error',
                reason: { kind: 'assembly-failed', detail: result.reason },
            }
        }
        assembledBytes.push(...result.signedTransactionsBytes)
    }

    return { kind: 'ready', assembledBytes }
}

/** Maps a structured error reason to the localized message for the dApp. */
export const errorReasonToMessage = (
    reason: HandoffErrorReason,
    messages: ResolverMessages,
): string => {
    switch (reason.kind) {
        case 'no-transactions': {
            return messages.noTransactions
        }
        case 'assembly-failed': {
            return messages.assemblyFailed(reason.detail)
        }
        case 'backend-failed': {
            return reason.displayReason ?? messages.failed
        }
        case 'session-disconnected': {
            // The peer is gone, so nobody reads this — reuse the
            // delivery-failed string instead of minting a locale key for a
            // dead letter.
            return messages.deliveryFailed
        }
    }
}

/**
 * How the resolver answers the WalletConnect peer. Injected from the app layer
 * so this pipeline module carries no WalletConnect dependency, and keyed by the
 * serializable {@link PendingWalletConnectHandoff.clientId} / `payloadId` so it
 * works for a rehydrated (post-kill) handoff that has no in-memory closures.
 * All three are best-effort: a peer whose session is gone (WC v1 keeps no
 * pending request across a kill) simply no-ops.
 */
export type HandoffPeerDelivery = {
    /** `approveRequest` with the assembled result array. May throw (dead session). */
    deliverResult: (
        clientId: string,
        payloadId: number,
        result: Nullable<string>[],
    ) => Promise<void>
    /** Clean soft-reject (decline / expired) — no connection-error banner. */
    deliverSoftReject: (
        clientId: string,
        payloadId: number,
        error: Error,
    ) => Promise<void>
    /** Terminal error reject, raising the connection-error banner. */
    deliverError: (
        clientId: string,
        payloadId: number,
        error: Error,
    ) => Promise<void>
}

type ResolveHandoffOutcomeArgs = {
    outcome: TerminalHandoffOutcome
    handoff: PendingWalletConnectHandoff
    messages: ResolverMessages
    delivery: HandoffPeerDelivery
    /** Best-effort backend notification; a rejection is logged, not surfaced. */
    markConfirmed: (input: {
        network: Network
        deviceId: string
        signRequestIds: string[]
    }) => Promise<void>
    /**
     * Best-effort cancel of the proposer's own backend sign request, called on
     * terminal failures (`error`, including a failed delivery of assembled
     * bytes, and `soft-reject`/`expired`). Nothing else terminalizes the
     * backend record when the dApp is gone, and the pending inbox reads
     * backend status — without this the request sits at pending/submitting
     * forever. NOT called on a delivered `ready` (success) or on
     * `soft-reject`/`declined` (a participant decline is already terminal on
     * the backend). Injected so this pipeline module stays free of the
     * multisig API; a rejection is logged, not surfaced.
     */
    cancelRequest?: () => Promise<void>
}

/**
 * Delivers a terminal outcome to the peer and clears the registry entry, once
 * per handoff.
 *
 * Hybrid delivery: the live session uses the transport-agnostic `callbacks`
 * closures (any source); a handoff resumed after an app kill has none, so it
 * falls back to the serializable WalletConnect `recovery` context via the
 * injected {@link HandoffPeerDelivery}. A rehydrated non-WC handoff has neither
 * and can only be cleaned up.
 *
 * On `ready`, `markConfirmed` is best-effort — the dApp already has the bytes —
 * but a failure to deliver falls through to `error` so it sees a rejection.
 * `soft-reject` deliberately raises no connection-error banner.
 */
export const resolveHandoffOutcome = async ({
    outcome,
    handoff,
    messages,
    delivery,
    markConfirmed,
    cancelRequest,
}: ResolveHandoffOutcomeArgs): Promise<void> => {
    switch (outcome.kind) {
        case 'ready': {
            await deliverReady(
                outcome.assembledBytes,
                handoff,
                messages,
                delivery,
                markConfirmed,
                cancelRequest,
            )
            return
        }
        case 'soft-reject': {
            const message =
                outcome.reason === 'declined'
                    ? messages.declined
                    : messages.expired
            await deliverSoftRejectToPeer(handoff, delivery, message)
            // 'declined' is already terminal on the backend; 'expired' is a
            // client-side deadline the backend may never mirror.
            if (outcome.reason === 'expired') {
                await cancelBackendRequest(handoff, cancelRequest)
            }
            walletConnectHandoffs.unregister(handoff.signRequestId)
            return
        }
        case 'error': {
            const message = errorReasonToMessage(outcome.reason, messages)
            logTerminalError(handoff, message)
            await deliverErrorToPeer(handoff, delivery, message)
            await cancelBackendRequest(handoff, cancelRequest)
            walletConnectHandoffs.unregister(handoff.signRequestId)
            return
        }
    }
}

/**
 * Best-effort: if the backend is unreachable or the caller had no proposer
 * address to build the cancel with, the orphaned record can still linger —
 * the handoff itself resolves regardless.
 */
const cancelBackendRequest = async (
    handoff: PendingWalletConnectHandoff,
    cancelRequest?: () => Promise<void>,
): Promise<void> => {
    if (!cancelRequest) return
    try {
        await cancelRequest()
    } catch (error) {
        logger.warn('WC multisig handoff backend cancel failed (non-fatal)', {
            signRequestId: handoff.signRequestId,
            error: error instanceof Error ? error.message : String(error),
        })
    }
}

/**
 * Clean soft-reject (decline / expired) — no connection-error banner. Prefers
 * the live closure; falls back to WC `recovery` for a resumed handoff. A
 * missing channel (rehydrated non-WC) is a no-op. Swallows failures — the
 * handoff resolves regardless.
 */
const deliverSoftRejectToPeer = async (
    handoff: PendingWalletConnectHandoff,
    delivery: HandoffPeerDelivery,
    message: string,
): Promise<void> => {
    const error = new Error(message)
    try {
        if (handoff.callbacks?.reject) {
            await handoff.callbacks.reject({ kind: 'softReject', error })
        } else if (handoff.recovery) {
            await delivery.deliverSoftReject(
                handoff.recovery.clientId,
                handoff.recovery.payloadId,
                error,
            )
        }
    } catch {
        // Peer notification failing is non-fatal.
    }
}

/**
 * Terminal error reject (raises the connection-error banner). Same
 * closure-then-`recovery` fallback and swallow semantics as
 * {@link deliverSoftRejectToPeer}.
 */
const deliverErrorToPeer = async (
    handoff: PendingWalletConnectHandoff,
    delivery: HandoffPeerDelivery,
    message: string,
): Promise<void> => {
    const error = new Error(message)
    try {
        if (handoff.callbacks?.error) {
            await handoff.callbacks.error(error)
        } else if (handoff.recovery) {
            await delivery.deliverError(
                handoff.recovery.clientId,
                handoff.recovery.payloadId,
                error,
            )
        }
    } catch {
        // Peer notification failing is non-fatal.
    }
}

const deliverReady = async (
    assembledBytes: Uint8Array[],
    handoff: PendingWalletConnectHandoff,
    messages: ResolverMessages,
    delivery: HandoffPeerDelivery,
    markConfirmed: ResolveHandoffOutcomeArgs['markConfirmed'],
    cancelRequest?: () => Promise<void>,
): Promise<void> => {
    try {
        if (handoff.callbacks?.approveSignedBytes) {
            // Live path: the closure owns the result-array construction.
            await handoff.callbacks.approveSignedBytes(assembledBytes)
        } else if (handoff.recovery) {
            // Resumed WC handoff: rebuild the result the closure would have.
            const result = buildWalletConnectSignResult(
                assembledBytes,
                handoff.recovery.indicesToSign,
                handoff.recovery.totalLength,
            )
            await delivery.deliverResult(
                handoff.recovery.clientId,
                handoff.recovery.payloadId,
                result,
            )
        } else {
            // Rehydrated non-WC handoff: no closure and no recovery context —
            // the originating transport is gone, so the bytes can't be
            // delivered. Nothing to do but drop the entry.
            logTerminalError(handoff, 'no delivery channel for resumed handoff')
            walletConnectHandoffs.unregister(handoff.signRequestId)
            return
        }
    } catch (error) {
        // Delivery failed (e.g. a dropped WC session). Fall through to `error`
        // so the dApp sees a rejection — it gets the generic localized message;
        // the raw error is kept for our logs only. The dApp never got the
        // bytes, so cancel the backend record too or the inbox item is
        // orphaned at pending/submitting.
        logTerminalError(handoff, messages.deliveryFailed, error)
        await deliverErrorToPeer(handoff, delivery, messages.deliveryFailed)
        await cancelBackendRequest(handoff, cancelRequest)
        walletConnectHandoffs.unregister(handoff.signRequestId)
        return
    }

    // Best-effort: tell the backend the wallet delivered, so it doesn't also
    // broadcast for `type: 'sync'` requests. A failure is non-fatal — the
    // dApp already has the signed bytes — but worth logging.
    try {
        await markConfirmed({
            network: handoff.network,
            deviceId: handoff.deviceId,
            signRequestIds: [handoff.signRequestId],
        })
    } catch (error) {
        logger.warn('WC multisig handoff mark-confirmed failed (non-fatal)', {
            signRequestId: handoff.signRequestId,
            error: error instanceof Error ? error.message : String(error),
        })
    }

    walletConnectHandoffs.unregister(handoff.signRequestId)
}

/**
 * An assembly mismatch is a crypto fault worth surfacing, not just handing to
 * the dApp. `cause` is logged but never sent onward.
 */
const logTerminalError = (
    handoff: PendingWalletConnectHandoff,
    message: string,
    cause?: unknown,
): void => {
    let causeText: string | undefined
    if (cause instanceof Error) causeText = cause.message
    else if (cause != null) causeText = String(cause)

    logger.warn('WC multisig handoff resolved with error', {
        signRequestId: handoff.signRequestId,
        sourceType: handoff.sourceType,
        message,
        cause: causeText,
    })
}
