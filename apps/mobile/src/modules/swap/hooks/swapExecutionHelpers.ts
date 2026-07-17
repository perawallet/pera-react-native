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

import type {
    PeraSignedTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { TransactionSignRequest } from '@perawallet/wallet-core-signing'
import type { SwapStatusUpdateRequest } from '@perawallet/wallet-core-swaps'
import {
    generateOrderedUniqueId,
    logger,
    type Optional,
} from '@perawallet/wallet-core-shared'

import { SwapUserRejectedError } from './swapGroupPlan'

/**
 * Cancel-shaped signing outcomes beyond the swap flow's own wrapper: the
 * pipeline's headless-cancel error and an on-device Ledger reject. Matched
 * by error name (both classes pin `name` with a string literal, so the
 * match survives minification) instead of `instanceof` so this stays free
 * of value imports from the signing/ledger packages — the primary cancel
 * path is the request's `reject` callback, which already yields
 * SwapUserRejectedError; this is defense-in-depth for a cancel leaking
 * through the `error` callback.
 */
const USER_REJECTION_ERROR_NAMES = new Set([
    'UserRejectedSigningError',
    'LedgerUserRejectedError',
])

/**
 * True for every cancel-shaped signing outcome. Keeps `reportSwapFailure`
 * unreachable for user cancellations, so the swap backend never records
 * `failed/blockchain_error` for a reject the user performed on-device.
 */
export const isUserRejectionError = (error: unknown): boolean =>
    error instanceof SwapUserRejectedError ||
    (error instanceof Error && USER_REJECTION_ERROR_NAMES.has(error.name))

/**
 * Hand a batch of unsigned transactions to the signing pipeline and wait for
 * the user-signed bytes to come back via the callback transport.
 *
 * This is a headless local callback request — the caller is responsible for
 * having shown a review UI on the preceding screen, so we leave the
 * `sourceType` as `'local'` (outside `INTERACTIVE_SOURCES`). The lifecycle
 * auto-resumes the machine at its `awaiting_user` pause, skipping the
 * standard review sheet.
 *
 * Rejections are surfaced as:
 * - {@link SwapUserRejectedError} when the user cancels — callers should
 *   treat this as a non-fatal cancellation and skip the backend failure
 *   report.
 * - The original Error when the pipeline reports a failure — callers
 *   should propagate this as a real signing error.
 */
type AddSignRequestFn = (request: TransactionSignRequest) => void

export const requestSwapSignatures = (
    addSignRequest: AddSignRequestFn,
    source: { name: string; description: string },
    unsignedTxs: PeraTransaction[],
    groupContext: PeraTransaction[],
): Promise<PeraSignedTransaction[]> =>
    new Promise((resolve, reject) => {
        const request: TransactionSignRequest = {
            id: generateOrderedUniqueId(),
            type: 'transactions',
            transport: 'callback',
            sourceType: 'local',
            txs: unsignedTxs,
            // Full atomic group as the backend assembled it (pre-signed +
            // user-signable slots). The signing-machine analyzer recomputes
            // the group hash over this payload, not the wallet-signable
            // subset — see validateTransactionGroupIntegrity.
            groupContext,
            sourceMetadata: source,
            approve: async signed => {
                resolve(signed)
            },
            reject: async () => {
                reject(new SwapUserRejectedError())
            },
            error: async (err: Error) => {
                reject(err)
            },
        }
        addSignRequest(request)
    })

/** Info handed back by the propose transport once the backend record exists. */
export type SwapProposedInfo = {
    signRequestId: string
    rawTransactionsBase64: string[]
}

/**
 * Shared-account variant of {@link requestSwapSignatures}: hand the unsigned
 * transactions to the signing pipeline, which (for a multisig sender) signs
 * with the proposer's local key(s) and proposes a `sync` multisig sign-request
 * to the backend instead of submitting. Resolves once the backend record is
 * created — the swap then completes asynchronously via the cosign resolver, so
 * the proposer does NOT wait for co-signer signatures here.
 *
 * Rejects with {@link SwapUserRejectedError} on user cancel, or the original
 * error if the propose itself fails.
 */
export const requestSwapProposal = (
    addSignRequest: AddSignRequestFn,
    source: { name: string; description: string },
    unsignedTxs: PeraTransaction[],
    groupContext: PeraTransaction[],
    onProposed: (info: SwapProposedInfo) => void,
): Promise<void> =>
    new Promise((resolve, reject) => {
        const request: TransactionSignRequest = {
            id: generateOrderedUniqueId(),
            type: 'transactions',
            transport: 'callback',
            sourceType: 'local',
            // Force the sync protocol: the backend collects signatures but does
            // NOT broadcast — the proposer's device assembles + submits via the
            // cosign resolver once threshold is met.
            transportOptions: { multisig: { proposeMode: 'sync' } },
            txs: unsignedTxs,
            groupContext,
            sourceMetadata: source,
            onProposed: async info => {
                onProposed({
                    signRequestId: info.signRequestId,
                    rawTransactionsBase64: info.rawTransactionsBase64,
                })
                resolve()
            },
            reject: async () => {
                reject(new SwapUserRejectedError())
            },
            error: async (err: Error) => {
                reject(err)
            },
        }
        addSignRequest(request)
    })

type UpdateSwapStatusFn = (params: {
    swapId: string
    data: SwapStatusUpdateRequest
}) => Promise<unknown>

/**
 * Report a swap as failed to the backend. Best-effort: if the report itself
 * fails, we log a warning and swallow the error — the caller has already
 * surfaced the underlying failure to the user, and retrying a status update
 * would only complicate the error path.
 *
 * Callers must NOT invoke this for user-initiated cancellations — only for
 * real blockchain or pipeline errors.
 */
export const reportSwapFailure = async (
    updateSwapStatus: UpdateSwapStatusFn,
    swapIdStr: Optional<string>,
): Promise<void> => {
    if (!swapIdStr) return
    try {
        await updateSwapStatus({
            swapId: swapIdStr,
            data: {
                status: 'failed',
                reason: 'blockchain_error',
                swap_version: 'v2',
            },
        })
    } catch {
        logger.warn('Failed to report swap failure to backend')
    }
}
