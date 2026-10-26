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

import type { Decimal } from 'decimal.js'
import type {
    ChainScope,
    ChainSubmissionData,
    ChainTransactionData,
    TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'

/**
 * What a history list shows for an attempt until its chain's history lists
 * the transaction. `fee` is in base units of the native asset; where gas
 * prices the fee, it is the most the transaction can be charged.
 */
export type SubmissionHistoryEntry = {
    summary: TransactionSummary
    chainData: ChainTransactionData
    fee?: Decimal
}

/**
 * Bump when SubmissionHistoryEntry, TransactionSummary or ChainTransactionData
 * change shape. Rows written under another version drop out of pending
 * history rather than render as the new shape; their transactions still show
 * once the chain lists them.
 */
export const SUBMISSION_HISTORY_ENTRY_VERSION = 1

/**
 * Lifecycle of a ledger row:
 * - `submitted` — the POST was issued (or is about to be); confirmation
 *   pending. Open.
 * - `unknown` — the POST failed without a node verdict; the group may still
 *   land. Open — the reconciler settles it.
 * - `confirmed` — definitively on chain. Terminal.
 * - `failed` — definitively not on chain (node rejection, or its chain bound
 *   passed without landing). Terminal.
 * - `replaced` — another transaction was mined at this attempt's account
 *   sequence number, so its bytes can never land. Terminal.
 */
export type SubmissionStatus =
    | 'submitted'
    | 'unknown'
    | 'confirmed'
    | 'failed'
    | 'replaced'

export const OPEN_SUBMISSION_STATUSES: readonly SubmissionStatus[] = [
    'submitted',
    'unknown',
]

/**
 * Statuses under which the group's bytes may be — or provably are — on chain.
 * `failed` is excluded on purpose: a node-rejected group is provably absent,
 * so the user is entitled to approve a fresh attempt.
 */
export const LANDABLE_SUBMISSION_STATUSES: readonly SubmissionStatus[] = [
    ...OPEN_SUBMISSION_STATUSES,
    'confirmed',
]

/**
 * Age past which an *unevaluatable* open row — one with no chain data,
 * which the reconciler can therefore never prove either way —
 * stops blocking new activity, so it cannot wedge a flow for the life of the
 * install.
 *
 * Deliberately NOT a general age bound. Rounds are not wall-clock: 1000
 * rounds is ~47 min on mainnet but exceeds an hour on any network with
 * slower blocks (Custom/fetch-from-node), so ageing out a row that still
 * carries a live validity window would re-open the double-spend window this
 * ledger exists to close. A row with chain data is one the reconciler
 * will settle on its own and is never dropped here.
 */
export const STALE_OPEN_ATTEMPT_MS = 60 * 60 * 1000

/**
 * How long a review the user approved can vouch for a transaction signed with
 * no review screen. A batch still running past it fails rather than signing on
 * an approval that old.
 */
export const REVIEW_APPROVAL_TTL_MS = 24 * 60 * 60 * 1000

export type SubmissionFlow =
    | 'pipeline'
    | 'rekey'
    | 'fee-delegation'
    | 'swap'
    | 'cosign'
    | 'sign-and-submit'
    | 'generic'
    | 'batch'

/**
 * Stable identity of a logical operation, used to match a rebuild/retry
 * against an earlier attempt that may still be unresolved. Serialized to
 * JSON for persistence.
 */
export type IntentKey =
    | { kind: 'rekey'; address: string }
    | { kind: 'swap'; swapId: string }
    | { kind: 'cosign'; signRequestId: string; swapId?: string }

export type SubmissionAttempt = {
    id: string
    /** Raw column value, a scope key. Decode with parseScopeKey. */
    network: string
    txIds: string[]
    intentKey: IntentKey | null
    flow: SubmissionFlow
    sender: string | null
    status: SubmissionStatus
    /** What the chain's reconciler bounds the attempt by; null when nothing. */
    chainData: ChainSubmissionData | null
    /**
     * The account sequence number the transaction consumes, on chains that
     * order an account's transactions by one; null otherwise.
     */
    nonce: number | null
    createdAt: number
    resolvedAt: number | null
    /** The broadcast transaction in its chain's own encoding; only the owning chain reads it. */
    rawTransaction: string | null
    /** Id of the attempt this one re-prices at the same sequence number; null when it replaces none. */
    replacesAttemptId: string | null
}

export type SubmissionAttemptWithHistoryEntry = SubmissionAttempt & {
    historyEntry: SubmissionHistoryEntry
}

/** An open attempt this wallet can re-price: it holds its broadcast bytes and nothing newer holds its sequence number. */
export type ReplaceableSubmissionAttempt = SubmissionAttempt & {
    rawTransaction: string
    nonce: number
    /** Null when the attempt recorded none, or it can't be read. */
    historyEntry: SubmissionHistoryEntry | null
}

export type UnsyncedSubmissionSpend = SubmissionAttempt & {
    /** Base units of the native asset: the most the transaction can be charged; null when unknown. */
    maxFee: Decimal | null
    /** Null when the attempt recorded none, or it can't be read. */
    historyEntry: SubmissionHistoryEntry | null
}

/**
 * - `running`: the transaction at `position` is being built, sent or awaited.
 * - `confirmed`: every transaction landed.
 * - `reverted`: the transaction at `position` landed and reverted; none after it was sent.
 * - `failed`: the transaction at `position` never landed (refused, dropped,
 *   replaced or unbuildable); none after it was sent.
 */
export type TransactionBatchOutcome =
    | 'running'
    | 'confirmed'
    | 'reverted'
    | 'failed'

export interface TransactionBatch {
    id: string
    /** The id the requester tracks the batch by. */
    batchId: string
    scope: ChainScope
    sender: string
    /** The review the user approved the batch on; see `ReviewApprovalRef`. */
    approvalToken: string
    /** Owned by the chain that recorded the batch; only it reads this. */
    payload: unknown
    /** `txIds[i]` is the hash of position i, recorded before it was sent. */
    txIds: string[]
    /** Hex of the signed transaction at `position` until it lands; null otherwise. */
    signedRaw: string | null
    /** The transaction being run, or where the run stopped. */
    position: number
    outcome: TransactionBatchOutcome
    createdAt: number
    updatedAt: number
}
