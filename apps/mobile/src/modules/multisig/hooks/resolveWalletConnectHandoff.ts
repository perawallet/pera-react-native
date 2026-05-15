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

import { AppState } from 'react-native'
import { assembleSignedMultisigTransactions } from '@perawallet/wallet-core-blockchain'
import {
    getSignRequestsWithSignatures,
    markSignRequestsConfirmed,
} from '@perawallet/wallet-core-multisig'
import { logger } from '@perawallet/wallet-core-shared'
import {
    walletConnectHandoffs,
    type PendingWalletConnectHandoff,
} from '@perawallet/wallet-core-signing'

/** Base delay between polls; backs off exponentially on consecutive errors. */
const BASE_POLL_INTERVAL_MS = 3000
/** Upper bound for the backed-off poll interval. */
const MAX_POLL_INTERVAL_MS = 30000

type SignRequestDetail = Awaited<
    ReturnType<typeof getSignRequestsWithSignatures>
>[number]

/**
 * Localized strings for the messages delivered to the dApp. Built by the
 * hook so this module stays outside the React / i18n tree and its functions
 * remain plain and unit-testable.
 */
export type ResolverMessages = {
    declined: string
    expired: string
    failed: string
    noTransactions: string
    deliveryFailed: string
    assemblyFailed: (reason: string) => string
}

/**
 * Shared state plus dependencies threaded through the polling state machine.
 * `resolved` and `timers` are owned by the resolver hook; this module only
 * mutates them.
 */
export type ResolverContext = {
    messages: ResolverMessages
    /** Sign-request ids that have already been delivered a terminal callback. */
    resolved: Set<string>
    /** In-flight poll timers, keyed by sign-request id. */
    timers: Map<string, ReturnType<typeof setTimeout>>
}

/**
 * Starts the poll loop for one handoff. Polls the backend until a terminal
 * status arrives, then delivers the outcome via the handoff's WC callbacks.
 *
 * Transient failures back off exponentially up to {@link MAX_POLL_INTERVAL_MS};
 * the loop ends only on a terminal backend status, on the handoff being
 * unregistered, or on hook unmount.
 */
export const startPolling = (
    handoff: PendingWalletConnectHandoff,
    ctx: ResolverContext,
): void => {
    let consecutiveErrors = 0

    const tick = async (): Promise<void> => {
        if (ctx.resolved.has(handoff.signRequestId)) return
        if (!walletConnectHandoffs.get(handoff.signRequestId)) return

        // Pause polling while the app is backgrounded. iOS suspends the
        // network for backgrounded apps, so a poll would just fail and
        // inflate the backoff — and even a successful poll could not be
        // delivered, since the WC socket is suspended too. Re-checking at
        // the base interval keeps the loop responsive on the next
        // foreground without the backoff ever climbing from this.
        if (AppState.currentState !== 'active') {
            ctx.timers.set(
                handoff.signRequestId,
                setTimeout(tick, BASE_POLL_INTERVAL_MS),
            )
            return
        }

        let shouldStop = false
        try {
            shouldStop = await runOnePoll(handoff, ctx)
            consecutiveErrors = 0
        } catch (error) {
            // Network blip / schema mismatch / transient backend error.
            // Don't surface it to the dApp — only terminal backend states
            // resolve the handoff. Log it so a persistent failure (e.g.
            // schema drift) is diagnosable rather than an invisible hang.
            // `appState` is logged because the multisig flow inherently
            // backgrounds the app (the user switches to the second wallet
            // to sign their participant) and iOS suspends network for
            // backgrounded apps — a poll that fails while not 'active'
            // points at suspension rather than a real backend fault.
            consecutiveErrors += 1
            logger.warn('WC multisig handoff poll failed; will retry', {
                signRequestId: handoff.signRequestId,
                sourceType: handoff.source.type,
                consecutiveErrors,
                appState: AppState.currentState,
                error: error instanceof Error ? error.message : String(error),
            })
        }

        if (
            ctx.resolved.has(handoff.signRequestId) ||
            !walletConnectHandoffs.get(handoff.signRequestId) ||
            shouldStop
        ) {
            stopPolling(handoff.signRequestId, ctx)
            return
        }

        const delay = Math.min(
            BASE_POLL_INTERVAL_MS * 2 ** consecutiveErrors,
            MAX_POLL_INTERVAL_MS,
        )
        ctx.timers.set(handoff.signRequestId, setTimeout(tick, delay))
    }

    // Schedule the first poll through the timer map rather than firing it
    // inline. This claims the timer slot synchronously, so the resolver
    // hook's per-handoff dedup guard (`timers.has(...)`) sees this handoff
    // the instant `startPolling` returns — otherwise a registry change
    // during the first poll's `await` re-runs the hook effect and starts a
    // duplicate poll loop. A 0ms delay still polls right away: single-device
    // flows usually have status='ready' the moment the propose call returns.
    ctx.timers.set(handoff.signRequestId, setTimeout(tick, 0))
}

/**
 * Drops the timer entry and the `resolved` guard for a finished handoff so
 * both collections stay bounded across a long-lived session.
 */
const stopPolling = (signRequestId: string, ctx: ResolverContext): void => {
    const timer = ctx.timers.get(signRequestId)
    if (timer) clearTimeout(timer)
    ctx.timers.delete(signRequestId)
    ctx.resolved.delete(signRequestId)
}

/**
 * Runs a single poll. Returns `true` when the handoff reached a terminal
 * state and polling should stop, `false` to keep polling.
 */
export const runOnePoll = async (
    handoff: PendingWalletConnectHandoff,
    ctx: ResolverContext,
): Promise<boolean> => {
    const responses = await getSignRequestsWithSignatures(handoff.network, {
        device_id: handoff.deviceId,
        proposed_sign_request_ids: [handoff.signRequestId],
    })
    const detail = responses.find(r => r.id === handoff.signRequestId)
    if (!detail) return false

    switch (detail.status) {
        case 'ready':
        case 'confirmed':
            return handleReady(handoff, ctx, detail)
        case 'declined':
            resolveSoftReject(handoff, ctx, ctx.messages.declined)
            return true
        case 'expired':
            resolveSoftReject(handoff, ctx, ctx.messages.expired)
            return true
        case 'failed':
            resolveError(
                handoff,
                ctx,
                detail.fail_reason_display ?? ctx.messages.failed,
            )
            return true
        default:
            // 'pending' / 'submitting' — keep polling.
            return false
    }
}

const handleReady = async (
    handoff: PendingWalletConnectHandoff,
    ctx: ResolverContext,
    detail: SignRequestDetail,
): Promise<boolean> => {
    // Race-condition guard: the backend can flip status to 'ready' before
    // every signature payload is serialized in the response. If any 'signed'
    // participant lacks a signatures array, abort this cycle — the next poll
    // will catch up.
    const lists = detail.transaction_lists ?? []
    for (const list of lists) {
        for (const resp of list.responses ?? []) {
            if (resp.response !== 'signed') continue
            if (!resp.signatures || resp.signatures.length === 0) return false
        }
    }

    if (lists.length === 0) {
        resolveError(handoff, ctx, ctx.messages.noTransactions)
        return true
    }

    // Assemble one composite SignedTransaction per item across all
    // transaction lists, in canonical order: by list, then by position
    // within the list.
    const assembledBytes: Uint8Array[] = []
    for (const list of lists) {
        const result = assembleSignedMultisigTransactions({
            rawTransactionsBase64: list.raw_transactions ?? [],
            participantAddresses: handoff.msigMetadata.addresses,
            version: handoff.msigMetadata.version,
            threshold: handoff.msigMetadata.threshold,
            responses: (list.responses ?? []).map(r => ({
                address: r.address,
                response: r.response,
                signatures: r.signatures,
            })),
        })
        if (result.kind === 'error') {
            resolveError(
                handoff,
                ctx,
                ctx.messages.assemblyFailed(result.reason),
            )
            return true
        }
        assembledBytes.push(...result.signedTransactionsBytes)
    }

    if (handoff.callbacks.approveSignedBytes) {
        try {
            await handoff.callbacks.approveSignedBytes(assembledBytes)
        } catch (error) {
            // approveRequest failed (e.g. session dropped). Fall through to
            // `error` so the dApp sees a rejection — with the localized
            // generic message; the raw error is kept for our logs only.
            resolveError(handoff, ctx, ctx.messages.deliveryFailed, error)
            return true
        }
    }

    // Best-effort: tell the backend the wallet delivered (so it doesn't also
    // broadcast for `type: 'sync'` requests). Failure is non-fatal — the dApp
    // already has the signed bytes — but worth logging.
    try {
        await markSignRequestsConfirmed(handoff.network, {
            device_id: handoff.deviceId,
            proposed_sign_request_ids: [handoff.signRequestId],
        })
    } catch (error) {
        logger.warn('WC multisig handoff mark-confirmed failed (non-fatal)', {
            signRequestId: handoff.signRequestId,
            error: error instanceof Error ? error.message : String(error),
        })
    }

    ctx.resolved.add(handoff.signRequestId)
    walletConnectHandoffs.unregister(handoff.signRequestId)
    return true
}

const resolveSoftReject = (
    handoff: PendingWalletConnectHandoff,
    ctx: ResolverContext,
    message: string,
): void => {
    ctx.resolved.add(handoff.signRequestId)
    void handoff.callbacks.softReject?.(new Error(message)).catch(() => {})
    walletConnectHandoffs.unregister(handoff.signRequestId)
}

/**
 * Delivers a terminal failure to the dApp via the WC `error` callback.
 *
 * Every terminal failure is logged — an assembly mismatch in particular is
 * a signature/crypto fault worth surfacing rather than only handing it to
 * the dApp. `cause` is the raw underlying error when there is one (e.g. a
 * dropped WC session on delivery); it is logged but never sent to the dApp,
 * which only ever sees the localized `message`.
 */
const resolveError = (
    handoff: PendingWalletConnectHandoff,
    ctx: ResolverContext,
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
    ctx.resolved.add(handoff.signRequestId)
    void handoff.callbacks.error?.(new Error(message)).catch(() => {})
    walletConnectHandoffs.unregister(handoff.signRequestId)
}
