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
    compactSignedResults,
    isQuantumSignedTransaction,
    type PeraSignedTransaction,
    type PeraTransaction,
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
 * Cancel-shaped outcomes beyond the swap flow's own wrapper. Matched by name
 * (both classes pin `name` to a literal, so it survives minification) rather
 * than `instanceof`, keeping this free of value imports. Defense-in-depth: the
 * primary cancel path is the request's `reject` callback.
 */
const USER_REJECTION_ERROR_NAMES = new Set([
    'UserRejectedSigningError',
    'LedgerUserRejectedError',
])

/**
 * Keeps `reportSwapFailure` unreachable for cancellations, so the backend never
 * records `failed/blockchain_error` for an on-device reject.
 */
export const isUserRejectionError = (error: unknown): boolean =>
    error instanceof SwapUserRejectedError ||
    (error instanceof Error && USER_REJECTION_ERROR_NAMES.has(error.name))

/**
 * A headless local callback request: `sourceType` stays `'local'` so the
 * lifecycle auto-resumes past `awaiting_user` and skips the review sheet — the
 * caller is responsible for having shown review UI on the preceding screen.
 *
 * Rejects with {@link SwapUserRejectedError} on cancel (non-fatal, skip the
 * backend failure report) or the original error on a real signing failure.
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
                // Only a feature flag keeps quantum accounts out of swap today
                // — nothing structural. The null-filter narrows back to the
                // module's plain-signature contract, but silently dropping a
                // quantum carrier would vanish signed slots and corrupt the
                // group into an opaque submission crash downstream. Fail loudly
                // instead (PQ-024 adds real support).
                const nonNull = compactSignedResults(signed)
                if (nonNull.some(isQuantumSignedTransaction)) {
                    reject(
                        new Error(
                            'Quantum accounts are not supported in swap flows yet',
                        ),
                    )
                    return
                }
                resolve(nonNull as PeraSignedTransaction[])
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
 * Shared-account variant of {@link requestSwapSignatures}: signs with the
 * proposer's local keys and proposes a `sync` sign-request instead of
 * submitting. Resolves once the backend record exists — the proposer does NOT
 * wait here for co-signers, since the cosign resolver completes the swap.
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
 * Best-effort: a failed report is logged and swallowed, since the caller has
 * already surfaced the real failure. NOT for user cancellations — only genuine
 * blockchain or pipeline errors.
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
