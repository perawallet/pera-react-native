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

import { logger } from '@perawallet/wallet-core-shared'
import type {
    HandoffErrorReason,
    TerminalHandoffOutcome,
} from './classifyHandoffPoll'
import { SubmissionError } from './errors'

/**
 * Side-effecting collaborators a multisig-handoff completion needs. Injected so
 * the orchestration stays a pure function of its inputs — unit-testable without
 * React, algod, or the multisig API — and so each consumer (swap today, future
 * submit-type accounts) supplies only its own submission + status semantics.
 */
export type MultisigHandoffCompletionDeps = {
    /**
     * Submit the assembled composite-multisig bytes to the chain and return the
     * resulting transaction ids. The consumer owns how the assembled signatures
     * are interleaved with any pre-signed slots and grouped for submission;
     * a throw here is treated as a terminal submission failure.
     */
    submit: (assembledBytes: Uint8Array[]) => Promise<string[]>
    /**
     * Durably record the group's tx ids the moment they're known — when
     * `submit` resolves (before any other post-submit side effect), or from an
     * `unknown-outcome` throw's deterministic ids so the retained handoff is
     * crash-safe. The consumer persists them so a crash between submission and
     * cleanup can't re-submit on relaunch (see `alreadySubmittedTxIds`).
     * Synchronous by design: a local store write, not a network call.
     * Best-effort.
     */
    recordSubmitted?: (txIds: string[]) => void
    /** Best-effort: tell the backend the wallet submitted, so it won't broadcast. */
    markConfirmed: () => Promise<void>
    /**
     * Best-effort: cancel the still-live sign-request (a proposer decline) on a
     * terminal failure, so a pending-signatures sheet / inbox go terminal
     * instead of lingering. May legitimately fail once threshold is met.
     */
    decline: () => Promise<void>
    /**
     * Drop the handoff from its registry once terminally resolved. Not called
     * on an `unknown-outcome` submit — the handoff is retained for
     * reconciliation.
     */
    removeHandoff: () => void
    /** Surface a terminal failure to the user (e.g. a localized toast). */
    reportError: (error: unknown) => void
    /** Record a successful submission (with the resulting tx ids). Best-effort. */
    onSubmitted: (txIds: string[]) => Promise<void>
    /** Record a clean soft-reject (user declined / request expired). Best-effort. */
    onSoftRejected: (reason: 'declined' | 'expired') => Promise<void>
    /** Record a terminal failure. Best-effort. */
    onFailed: () => Promise<void>
}

/** Fallback when a backend `failed` carries no display reason of its own. */
const FALLBACK_ERROR_MESSAGE = 'Multisig sign request could not be completed'

/**
 * Completes a multisig handoff once the co-signer's signatures have been
 * collected (`ready`), or terminates it cleanly on decline / expiry / error.
 *
 * Owns the completion sequence and its error-handling discipline — the part
 * that's easy to get subtly wrong and must not diverge between consumers:
 *
 *  - `ready`: submit the assembled bytes, record the submission with the
 *    resulting tx ids, then best-effort `markConfirmed` so the backend doesn't
 *    also broadcast. A definitive failure (submit rejected, assembly bug)
 *    falls through to the failure path.
 *  - `ready` with an `unknown-outcome` submit error: the group may still land,
 *    so its deterministic tx ids are recorded and the handoff is RETAINED for
 *    reconciliation to settle — no decline, no failure status, and no
 *    user-facing error for a transaction that may have succeeded.
 *  - failure (`error`, or a definitively rejected `ready`): notify the user,
 *    best-effort cancel the still-live request, then record the failure.
 *  - `soft-reject`: record the clean rejection.
 *
 * Cleanup is outcome-conditional: the handoff is removed exactly once on every
 * terminal outcome, but retained on an unknown-outcome submit so it isn't
 * dropped while reconciliation is the only recovery path. Status / decline /
 * mark-confirmed side effects are best-effort: a rejection is logged, never
 * allowed to block teardown.
 */
export const completeMultisigHandoff = async ({
    outcome,
    deps,
    alreadySubmittedTxIds,
}: {
    outcome: TerminalHandoffOutcome
    deps: MultisigHandoffCompletionDeps
    /**
     * Tx ids persisted by `recordSubmitted` in a previous session. When set,
     * the transactions are already on chain: never submit again (algod would
     * reject the duplicate and the failure path would flip a landed swap to
     * "failed"), and ignore whatever the poll now says — a post-crash
     * `expired`/`failed` status just means mark-confirmed never made it.
     * Only the best-effort post-submit tail is replayed.
     */
    alreadySubmittedTxIds?: string[]
}): Promise<void> => {
    if (alreadySubmittedTxIds) {
        await runBestEffort(
            () => deps.onSubmitted(alreadySubmittedTxIds),
            'status update',
        )
        await runBestEffort(() => deps.markConfirmed(), 'mark-confirmed')
        deps.removeHandoff()
        return
    }

    if (outcome.kind === 'soft-reject') {
        await runBestEffort(
            () => deps.onSoftRejected(outcome.reason),
            'status update',
        )
        deps.removeHandoff()
        return
    }

    if (outcome.kind === 'error') {
        await failHandoff(deps, errorFromReason(outcome.reason))
        deps.removeHandoff()
        return
    }

    // outcome.kind === 'ready'
    let shouldRetainHandoff = false
    try {
        const txIds = await deps.submit(outcome.assembledBytes)
        // The group is on chain from here — nothing below may reach the
        // failure path, including a throwing marker write.
        await runBestEffort(
            async () => deps.recordSubmitted?.(txIds),
            'record-submitted',
        )
        await runBestEffort(() => deps.onSubmitted(txIds), 'status update')
        // Non-fatal: the transactions are already on chain.
        await runBestEffort(() => deps.markConfirmed(), 'mark-confirmed')
    } catch (error) {
        if (isPossiblyLanded(error)) {
            shouldRetainHandoff = true
            // The group may still land: persist its deterministic tx ids so the
            // retained handoff is crash-safe, then let reconciliation settle the
            // outcome — no decline, no failure status, no user-facing error.
            await runBestEffort(
                async () => deps.recordSubmitted?.(error.txIds),
                'record-submitted',
            )
        } else {
            await failHandoff(deps, error)
        }
    } finally {
        if (!shouldRetainHandoff) {
            deps.removeHandoff()
        }
    }
}

/**
 * A submit that got no node verdict may still be confirming. Declining would
 * cancel a live request for a transaction that lands moments later; an
 * unresolved request expires on its own, which is the recoverable outcome.
 */
const isPossiblyLanded = (
    error: unknown,
): error is SubmissionError & { classification: 'unknown-outcome' } =>
    error instanceof SubmissionError &&
    error.classification === 'unknown-outcome'

/**
 * Common terminal-failure path: notify the user, cancel the still-live
 * sign-request (best-effort, skipped when the submission's outcome is
 * unknown), then record the failure. Does NOT remove the handoff — the
 * caller owns that so the `ready` path keeps its outcome-conditional
 * `finally` cleanup.
 */
const failHandoff = async (
    deps: MultisigHandoffCompletionDeps,
    error: unknown,
): Promise<void> => {
    logger.warn('Multisig handoff completion failed', {
        error: error instanceof Error ? error.message : String(error),
    })
    deps.reportError(error)
    if (!isPossiblyLanded(error)) {
        await runBestEffort(() => deps.decline(), 'decline')
    }
    await runBestEffort(() => deps.onFailed(), 'status update')
}

/** Maps a terminal error reason to the error reported to the user. */
const errorFromReason = (reason: HandoffErrorReason): Error => {
    const displayReason =
        'displayReason' in reason ? reason.displayReason : undefined
    return new Error(displayReason ?? FALLBACK_ERROR_MESSAGE)
}

/** Runs a best-effort side effect — never lets a rejection propagate. */
const runBestEffort = async (
    run: () => Promise<unknown>,
    label: string,
): Promise<void> => {
    try {
        await run()
    } catch (error) {
        logger.warn(`Multisig handoff ${label} failed (non-fatal)`, {
            error: error instanceof Error ? error.message : String(error),
        })
    }
}
