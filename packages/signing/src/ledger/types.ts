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

/**
 * Lifecycle of a ledger row (PERA-4588):
 * - `submitted` — the POST was issued (or is about to be); confirmation
 *   pending. Open.
 * - `unknown` — the POST failed without a node verdict; the group may still
 *   land. Open — the reconciler settles it.
 * - `confirmed` — definitively on chain. Terminal.
 * - `failed` — definitively not on chain (node rejection, or lastValid
 *   expired without landing). Terminal.
 */
export type SubmissionStatus = 'submitted' | 'unknown' | 'confirmed' | 'failed'

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
 * Age past which an open row can no longer describe a group that might still
 * land: a validity window is capped at 1000 rounds (~50 min), so anything
 * older has expired whatever the reconciler could still prove. Rows past it
 * stay open (only proof resolves them) but stop blocking new activity, so a
 * row the reconciler can never settle cannot wedge a flow forever.
 */
export const STALE_OPEN_ATTEMPT_MS = 60 * 60 * 1000

export type SubmissionFlow =
    | 'pipeline'
    | 'rekey'
    | 'fee-delegation'
    | 'swap'
    | 'cosign'
    | 'sign-and-submit'
    | 'generic'

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
    network: string
    txIds: string[]
    intentKey: IntentKey | null
    flow: SubmissionFlow
    sender: string | null
    status: SubmissionStatus
    /** Validity window of the decoded txn, in rounds. */
    lastValid: number | null
    createdAt: number
    resolvedAt: number | null
}
