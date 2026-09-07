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
    type PeraSignedTransaction,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import {
    isQuantumAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { TransactionSignRequest } from '@perawallet/wallet-core-signing'
import type { SwapStatusUpdateRequest } from '@perawallet/wallet-core-swaps'
import {
    generateOrderedUniqueId,
    logger,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'

import { SwapUserRejectedError } from './swapGroupPlan'

/**
 * Quantum accounts pay a raised post-quantum minimum fee, but a swap group's
 * fee is fixed by the backend's `prepare-transactions` response and cannot be
 * raised on device: the group interleaves backend PRE-SIGNED transactions
 * with the user's, and raising a fee forces a `grp` recomputation that would
 * invalidate those signatures. The swap flow also never calls the minimum-fee
 * pipeline at all — there is no `signableIndices` to key an adjustment off.
 * The guard yields to the `enable_quantum_swap` remote flag: turning it on
 * asserts that the backend prices the pqsig surcharge into prepared groups,
 * and turning it off restores the hard block — the
 * flag is the kill switch if that pricing regresses.
 */
export const QUANTUM_SWAP_FEE_BLOCKED_KEY =
    'swap.execution.quantum_fee_unsupported'

/**
 * Quantum accounts don't participate in multisig at all (established
 * separately in this plan), so this branch should be unreachable in
 * practice — this is defence in depth. Without it, a quantum result handed
 * to `createMultisigStrategy`'s `extractSignatures` would silently resolve
 * to `null` for every slot, and the proposer would POST an empty signature
 * to the backend instead of failing loudly.
 */
export const QUANTUM_SWAP_PROPOSE_BLOCKED_KEY =
    'swap.execution.quantum_multisig_unsupported'

/**
 * A quantum signer was blocked before signing. Carries the i18n key rather
 * than an English sentence: the swap error path displays `error.message`
 * verbatim to the user (see `useSwapExecution`), so a hardcoded English
 * string there would reach non-English users untranslated — defeating the
 * whole point of these guards, which is that the failure is loud AND
 * correctly attributed. `message` stays English for logs/crash reports.
 */
export class QuantumSwapBlockedError extends Error {
    /**
     * Pinned as a string literal so the name survives minification, matching
     * the convention in {@link USER_REJECTION_ERROR_NAMES}.
     */
    override readonly name = 'QuantumSwapBlockedError'

    /** Key to render with `t()` at the display site. */
    readonly translationKey: string

    constructor(translationKey: string) {
        super(`Quantum accounts are not supported here (${translationKey})`)
        this.translationKey = translationKey
    }
}

/**
 * Rejects with a {@link QuantumSwapBlockedError} for `translationKey` when
 * `signer` is a quantum account.
 *
 * Callers MUST pass the resolved EFFECTIVE signer (e.g. via `useSignerFor`),
 * not the raw selected/sender account: a standard or multisig account rekeyed
 * to a quantum auth account still has its own nominal `type` (e.g. `algo25`),
 * but Falcon-signs via the resolved auth account. Checking the raw account's
 * `type` alone would let a rekeyed-to-quantum sender sail past this guard —
 * see `useTransactionConfirmationScreen`'s `isQuantumFee` for the same
 * resolve-then-check pattern.
 */
const rejectIfQuantumAccount = (
    signer: Nullable<WalletAccount>,
    translationKey: string,
): Optional<Promise<never>> => {
    if (signer && isQuantumAccount(signer)) {
        return Promise.reject(new QuantumSwapBlockedError(translationKey))
    }
    return undefined
}

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
    // Resolved effective signer (`useSignerFor`), not the raw selected
    // account — see {@link rejectIfQuantumAccount}.
    signer: Nullable<WalletAccount>,
    source: { name: string; description: string },
    unsignedTxs: PeraTransaction[],
    groupContext: PeraTransaction[],
    options: {
        /**
         * `enable_quantum_swap` remote flag (`useIsQuantumSwapEnabled`).
         * When false, quantum signers are rejected before signing — see
         * {@link QUANTUM_SWAP_FEE_BLOCKED_KEY}.
         */
        isQuantumSwapEnabled: boolean
    },
): Promise<PeraSignedTransaction[]> => {
    if (!options.isQuantumSwapEnabled) {
        const blocked = rejectIfQuantumAccount(
            signer,
            QUANTUM_SWAP_FEE_BLOCKED_KEY,
        )
        if (blocked) return blocked
    }

    return new Promise((resolve, reject) => {
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
                // The null-filter is defensive narrowing back to the swap
                // module's plain-signature contract — this single full-group
                // sign never pads null slots, but a stray null must still be
                // dropped before resolving.
                resolve(compactSignedResults(signed))
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
}

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
 *
 * Takes the RESOLVED signer, not the raw multisig account: a multisig can
 * itself be rekeyed to a quantum auth account, which the guard below must see
 * (see {@link QUANTUM_SWAP_PROPOSE_BLOCKED_KEY}).
 */
export const requestSwapProposal = (
    addSignRequest: AddSignRequestFn,
    // Resolved effective signer (`useSignerFor`), not the raw selected
    // account — see {@link rejectIfQuantumAccount}.
    signer: Nullable<WalletAccount>,
    source: { name: string; description: string },
    unsignedTxs: PeraTransaction[],
    groupContext: PeraTransaction[],
    onProposed: (info: SwapProposedInfo) => void,
): Promise<void> => {
    const blocked = rejectIfQuantumAccount(
        signer,
        QUANTUM_SWAP_PROPOSE_BLOCKED_KEY,
    )
    if (blocked) return blocked

    return new Promise((resolve, reject) => {
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
}

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
