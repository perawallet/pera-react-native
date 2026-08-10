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
    completeMultisigHandoff,
    type TerminalHandoffOutcome,
} from '@perawallet/wallet-core-signing'
import type { SwapStatusUpdateRequest } from '../api'
import type { SwapHandoffRecord } from '../models'

/**
 * Side-effecting collaborators the swap-handoff resolution needs. Injected so
 * the orchestration stays a pure function of its inputs and is unit testable
 * without React, algod, or the multisig API.
 */
export type SwapHandoffResolutionDeps = {
    /** Submit one atomic group's ordered raw signed bytes to algod → txIds. */
    submitGroup: (rawSignedTransactions: Uint8Array[]) => Promise<string[]>
    /** base64 → raw bytes (for the persisted pre-signed slot transactions). */
    decodeBase64: (base64: string) => Uint8Array
    /**
     * Persist the submitted marker (tx ids) on the handoff record the moment
     * algod accepts, so a crash before cleanup can't re-submit on relaunch.
     */
    markSubmitted: (txIds: string[]) => void
    /** PATCH the swap's backend status. */
    updateSwapStatus: (input: {
        swapId: string
        data: SwapStatusUpdateRequest
    }) => Promise<unknown>
    /** Best-effort: tell the backend the wallet submitted, so it won't broadcast. */
    markConfirmed: (input: {
        network: SwapHandoffRecord['network']
        deviceId: string
        signRequestIds: string[]
    }) => Promise<void>
    /** Drop the handoff from the persisted store once terminally resolved. */
    removeHandoff: (signRequestId: string) => void
    /**
     * Surface a terminal failure to the user as a localized toast. The resolver
     * runs app-wide (and on launch), so this is the proposer's only feedback
     * that a co-signed swap failed — the "Submitting…" sheet otherwise gives no
     * reason. Algod errors are mapped to a friendly message by the caller.
     */
    reportError: (error: unknown) => void
    /**
     * Best-effort: cancel the still-live multisig sign-request (a proposer
     * decline) so the pending-signatures sheet / inbox go terminal instead of
     * lingering on "Submitting…" until expiry. The backend may refuse a decline
     * once threshold is met, so a failure here is swallowed — the swap is still
     * marked failed and the user is still notified.
     */
    declineSignRequest: (signRequestId: string) => Promise<void>
}

/**
 * Interleaves a group's pre-signed slots with the assembled multisig bytes,
 * in submission order. Throws if a to-sign slot has no assembled counterpart
 * (a backend/assembly bug — never submit a partial group).
 */
const buildGroupBytes = (
    plan: SwapHandoffRecord['plan'][number],
    assembledBytes: Uint8Array[],
    decodeBase64: SwapHandoffResolutionDeps['decodeBase64'],
): Uint8Array[] =>
    plan.slots.map(slot => {
        if (slot.kind === 'preSigned') {
            return decodeBase64(slot.signedTxnBase64)
        }
        const assembled = assembledBytes[slot.flatIndex]
        if (!assembled) {
            throw new Error(
                `Missing assembled signature for slot ${slot.flatIndex}`,
            )
        }
        return assembled
    })

/**
 * Completes a shared-account swap once the co-signer's signatures have been
 * collected (or fails it cleanly on decline / expiry / error).
 *
 * A swap adapter over the shared {@link completeMultisigHandoff}: that owns the
 * completion sequence and its error-handling discipline (submit → record →
 * mark-confirmed, decline-on-failure, single cleanup, best-effort side effects);
 * this supplies only the swap-specific bits — interleaving the persisted
 * pre-signed slots with the assembled composite-multisig bytes and submitting
 * each group to algod, and mapping outcomes to the swap's backend status
 * (`in_progress` with txIds / `cancelled` / `failed`).
 */
export const resolveSwapHandoffOutcome = async ({
    outcome,
    record,
    deps,
}: {
    outcome: TerminalHandoffOutcome
    record: SwapHandoffRecord
    deps: SwapHandoffResolutionDeps
}): Promise<void> => {
    const { signRequestId, swapIdStr, network, deviceId, plan } = record

    await completeMultisigHandoff({
        outcome,
        // A crash-recovered record that already landed on chain: the shared
        // orchestrator replays the post-submit tail instead of re-submitting.
        alreadySubmittedTxIds: record.submission?.txIds,
        deps: {
            recordSubmitted: deps.markSubmitted,
            // Interleave each group's pre-signed slots with the assembled
            // bytes and submit, collecting the resulting txIds in order. A
            // missing assembled slot throws here → the shared orchestrator
            // treats it as a terminal submission failure (no partial group).
            submit: async assembledBytes => {
                const txIds: string[] = []
                for (const group of plan) {
                    const groupBytes = buildGroupBytes(
                        group,
                        assembledBytes,
                        deps.decodeBase64,
                    )
                    if (groupBytes.length === 0) continue
                    const ids = await deps.submitGroup(groupBytes)
                    txIds.push(...ids)
                }
                return txIds
            },
            markConfirmed: () =>
                deps.markConfirmed({
                    network,
                    deviceId,
                    signRequestIds: [signRequestId],
                }),
            decline: () => deps.declineSignRequest(signRequestId),
            removeHandoff: () => deps.removeHandoff(signRequestId),
            reportError: deps.reportError,
            onSubmitted: async txIds => {
                await deps.updateSwapStatus({
                    swapId: swapIdStr,
                    data: {
                        status: 'in_progress',
                        submitted_transaction_ids: txIds,
                        swap_version: 'v2',
                    },
                })
            },
            // declined → user cancelled; expired → timed out.
            onSoftRejected: async reason => {
                await deps.updateSwapStatus({
                    swapId: swapIdStr,
                    data: {
                        status: reason === 'declined' ? 'cancelled' : 'failed',
                        reason:
                            reason === 'declined' ? 'user_cancelled' : 'other',
                        swap_version: 'v2',
                    },
                })
            },
            onFailed: async () => {
                await deps.updateSwapStatus({
                    swapId: swapIdStr,
                    data: {
                        status: 'failed',
                        reason: 'blockchain_error',
                        swap_version: 'v2',
                    },
                })
            },
        },
    })
}
