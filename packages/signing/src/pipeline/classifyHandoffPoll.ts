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
import { logger, type Network } from '@perawallet/wallet-core-shared'
import {
    walletConnectHandoffs,
    type PendingWalletConnectHandoff,
} from './walletConnectHandoffs'
import type { RejectReason } from './types'

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
export const classifyHandoffPoll = (
    detail: HandoffPollDetail,
    handoff: HandoffAssemblyContext,
): HandoffPollOutcome => {
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

const classifyReadyPoll = (
    detail: HandoffPollDetail,
    handoff: HandoffAssemblyContext,
): HandoffPollOutcome => {
    const lists = detail.transaction_lists

    // Race-condition guard: the backend can flip status to 'ready' before
    // every signature payload is serialized in the response. If any 'signed'
    // participant lacks signatures, keep polling — the next poll catches up.
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
        const result = assembleSignedMultisigTransactions({
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
    }
}

type ResolveHandoffOutcomeArgs = {
    outcome: TerminalHandoffOutcome
    handoff: PendingWalletConnectHandoff
    messages: ResolverMessages
    /** Best-effort backend notification; a rejection is logged, not surfaced. */
    markConfirmed: (input: {
        network: Network
        deviceId: string
        signRequestIds: string[]
    }) => Promise<void>
}

/**
 * Delivers a terminal outcome and clears the registry entry, once per handoff.
 *
 * On `ready`, `markConfirmed` is best-effort — the dApp already has the bytes —
 * but a failure to deliver falls through to `error` so it sees a rejection.
 * `soft-reject` deliberately raises no connection-error banner.
 */
export const resolveHandoffOutcome = async ({
    outcome,
    handoff,
    messages,
    markConfirmed,
}: ResolveHandoffOutcomeArgs): Promise<void> => {
    switch (outcome.kind) {
        case 'ready': {
            await deliverReady(
                outcome.assembledBytes,
                handoff,
                messages,
                markConfirmed,
            )
            return
        }
        case 'soft-reject': {
            const message =
                outcome.reason === 'declined'
                    ? messages.declined
                    : messages.expired
            await notifySoftReject(handoff.callbacks.reject, message)
            walletConnectHandoffs.unregister(handoff.signRequestId)
            return
        }
        case 'error': {
            const message = errorReasonToMessage(outcome.reason, messages)
            logTerminalError(handoff, message)
            await notifyPeer(handoff.callbacks.error, message)
            walletConnectHandoffs.unregister(handoff.signRequestId)
            return
        }
    }
}

const deliverReady = async (
    assembledBytes: Uint8Array[],
    handoff: PendingWalletConnectHandoff,
    messages: ResolverMessages,
    markConfirmed: ResolveHandoffOutcomeArgs['markConfirmed'],
): Promise<void> => {
    try {
        await handoff.callbacks.approveSignedBytes?.(assembledBytes)
    } catch (error) {
        // approveRequest failed (e.g. a dropped WC session). Fall through to
        // `error` so the dApp sees a rejection — it gets the generic
        // localized message; the raw error is kept for our logs only.
        logTerminalError(handoff, messages.deliveryFailed, error)
        await notifyPeer(handoff.callbacks.error, messages.deliveryFailed)
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

/** Invokes a dApp callback with the message, swallowing any rejection. */
const notifyPeer = async (
    callback: ((error: Error) => Promise<void>) | undefined,
    message: string,
): Promise<void> => {
    try {
        await callback?.(new Error(message))
    } catch {
        // The peer callback (WC rejectRequest) failing is non-fatal — the
        // handoff is resolved regardless.
    }
}

/**
 * Invokes the source's `reject` callback with a `softReject` reason.
 * Mirrors `notifyPeer`'s rejection-swallowing semantics.
 */
const notifySoftReject = async (
    reject: ((reason?: RejectReason) => Promise<void>) | undefined,
    message: string,
): Promise<void> => {
    try {
        await reject?.({ kind: 'softReject', error: new Error(message) })
    } catch {
        // The peer callback failing is non-fatal — handoff is resolved regardless.
    }
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
        sourceType: handoff.source.type,
        message,
        cause: causeText,
    })
}
