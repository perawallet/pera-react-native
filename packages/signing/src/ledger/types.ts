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
    /** First txid — the SHA-512/256-derived bytes identity (see schema). */
    bytesHash: string | null
    /** base64 of the submitted group bytes, when retained. */
    signedBytesBase64: string | null
    status: SubmissionStatus
    /** Validity window of the decoded txn, in rounds. */
    firstValid: number | null
    lastValid: number | null
    createdAt: number
    resolvedAt: number | null
}
