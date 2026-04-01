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

import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { Decimal } from 'decimal.js'

import type { SigningMachineContext } from '../machine/context'
import type {
    PipelineStage,
    SigningPipelineEvent,
    SignRequest,
    TransactionWarning,
} from '../models'
import type {
    RequestStructure,
    TransactionListItem,
} from '../utils/classification'

/**
 * Configuration passed to useSigningPipeline.
 * The onEvent callback is called once per state transition.
 */
export type SigningConfiguration = {
    onEvent?: (event: SigningPipelineEvent) => void
}

/**
 * The pipeline object returned by useSigningPipeline.
 * Combines display data, machine state, and controls in one place.
 */
export type SigningPipeline = {
    /** The current signing request, or undefined if the queue is empty. */
    currentRequest: SignRequest | undefined

    /** Current machine stage. */
    stage: PipelineStage

    /** True while the machine is in 'signing' or 'transporting'. */
    isLoading: boolean

    /** True when the machine is in 'failed' with a retryable error. */
    isRetryable: boolean

    /** The error if stage === 'failed', otherwise null. */
    error: Error | null

    // -------------------------------------------------------------------------
    // Display data — equivalent to useSigningRequestAnalysis output.
    // Populated from request.txs for transaction requests; empty for others.
    // -------------------------------------------------------------------------
    allTransactions: PeraDisplayableTransaction[]
    listItems: TransactionListItem[]
    signableAddresses: Set<string>
    totalFee: Decimal
    warnings: TransactionWarning[]
    distinctWarnings: TransactionWarning[]
    requestStructure: RequestStructure

    // -------------------------------------------------------------------------
    // Controls
    // -------------------------------------------------------------------------

    /** Approve the current request (sends USER_APPROVED). No-op when idle. */
    next: () => void

    /** Reject the current request (sends USER_REJECTED). No-op when idle. */
    fail: () => void

    /** Retry after a retryable failure (sends RETRY). No-op when not retryable. */
    retry: () => void
}

export type MachineSnapshot = {
    value: unknown
    context: SigningMachineContext
    matches: (stateValue: string) => boolean
}
