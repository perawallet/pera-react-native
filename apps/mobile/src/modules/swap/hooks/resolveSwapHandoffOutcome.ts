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

import { logger } from '@perawallet/wallet-core-shared'
import type { TerminalHandoffOutcome } from '@perawallet/wallet-core-signing'
import type {
    SwapHandoffRecord,
    SwapStatusUpdateRequest,
} from '@perawallet/wallet-core-swaps'

/**
 * Side-effecting collaborators the swap-handoff resolution needs. Injected so
 * the orchestration below stays a pure function of its inputs and is unit
 * testable without React, algod, or the multisig API.
 */
export type SwapHandoffResolutionDeps = {
    /** Submit one atomic group's ordered raw signed bytes to algod → txIds. */
    submitGroup: (rawSignedTransactions: Uint8Array[]) => Promise<string[]>
    /** base64 → raw bytes (for the persisted pre-signed slot transactions). */
    decodeBase64: (base64: string) => Uint8Array
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
 * On `ready`: per group, interleave the persisted pre-signed slots with the
 * assembled composite-multisig bytes and submit to algod; then mark the swap
 * `in_progress` with the resulting txIds and best-effort `markConfirmed` so the
 * backend doesn't also broadcast. A submission failure flips the swap to
 * `failed`. Either way the handoff is removed so it isn't retried endlessly.
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

    if (outcome.kind === 'soft-reject') {
        // declined → user cancelled; expired → timed out.
        await safeUpdateSwapStatus(deps, swapIdStr, {
            status: outcome.reason === 'declined' ? 'cancelled' : 'failed',
            reason: outcome.reason === 'declined' ? 'user_cancelled' : 'other',
            swap_version: 'v2',
        })
        deps.removeHandoff(signRequestId)
        return
    }

    if (outcome.kind === 'error') {
        await safeUpdateSwapStatus(deps, swapIdStr, {
            status: 'failed',
            reason: 'blockchain_error',
            swap_version: 'v2',
        })
        deps.removeHandoff(signRequestId)
        return
    }

    // outcome.kind === 'ready'
    try {
        const txIds: string[] = []
        for (const group of plan) {
            const groupBytes = buildGroupBytes(
                group,
                outcome.assembledBytes,
                deps.decodeBase64,
            )
            if (groupBytes.length === 0) continue
            const ids = await deps.submitGroup(groupBytes)
            txIds.push(...ids)
        }

        await safeUpdateSwapStatus(deps, swapIdStr, {
            status: 'in_progress',
            submitted_transaction_ids: txIds,
            swap_version: 'v2',
        })

        // Best-effort: a failure here is non-fatal (txns are already on chain).
        try {
            await deps.markConfirmed({
                network,
                deviceId,
                signRequestIds: [signRequestId],
            })
        } catch (error) {
            logger.warn('Swap handoff mark-confirmed failed (non-fatal)', {
                signRequestId,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    } catch (error) {
        logger.warn('Shared-account swap submission failed', {
            signRequestId,
            error: error instanceof Error ? error.message : String(error),
        })
        await safeUpdateSwapStatus(deps, swapIdStr, {
            status: 'failed',
            reason: 'blockchain_error',
            swap_version: 'v2',
        })
    } finally {
        deps.removeHandoff(signRequestId)
    }
}

/** Status update is best-effort reporting — never let it throw past us. */
const safeUpdateSwapStatus = async (
    deps: SwapHandoffResolutionDeps,
    swapId: string,
    data: SwapStatusUpdateRequest,
): Promise<void> => {
    try {
        await deps.updateSwapStatus({ swapId, data })
    } catch (error) {
        logger.warn('Swap handoff status update failed (non-fatal)', {
            swapId,
            error: error instanceof Error ? error.message : String(error),
        })
    }
}
