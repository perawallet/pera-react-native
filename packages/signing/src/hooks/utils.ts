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

import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { AppError, type Nullable } from '@perawallet/wallet-core-shared'
import { Decimal } from 'decimal.js'

import type {
    ResolvedSignerType,
    SigningMachineContext,
} from '../machine/context'
import type {
    PipelineStage,
    SigningPipelineEvent,
    TransactionWarning,
} from '../models'
import type { TransactionListItem } from '../utils/classification'
import type { QuantumFeeAdjustment } from '../pipeline/sources'
import type { MachineSnapshot } from './types'

// =============================================================================
// Empty defaults
// =============================================================================

export const EMPTY_TRANSACTIONS: PeraDisplayableTransaction[] = []
export const EMPTY_LIST_ITEMS: TransactionListItem[] = []
export const EMPTY_WARNINGS: TransactionWarning[] = []
export const EMPTY_SIGNABLE_ADDRESSES = new Set<string>()
export const EMPTY_SIGNABLE_INDICES = new Set<number>()
export const EMPTY_FEE_ADJUSTMENTS: QuantumFeeAdjustment[] = Object.freeze(
    [] as QuantumFeeAdjustment[],
) as QuantumFeeAdjustment[]
export const ZERO_FEE = new Decimal(0)

// =============================================================================
// Snapshot helpers — typed against machine context shape
// =============================================================================

export const deriveStage = (snapshot: MachineSnapshot): PipelineStage => {
    if (snapshot.matches('completed')) return 'completed'
    if (snapshot.matches('rejected')) return 'rejected'
    if (snapshot.matches('failed')) return 'failed'
    if (snapshot.matches('transporting')) return 'transporting'
    // 'signing' parent state covers routing, localKey, hardware, multisig substates
    if (snapshot.matches('signing')) return 'signing'
    if (snapshot.matches('awaiting_user')) return 'awaiting_user'
    if (snapshot.matches('validating')) return 'validating'
    if (snapshot.matches('idle')) return 'idle'
    return 'idle'
}

export const isRetryableError = (error: Nullable<Error>): boolean => {
    if (!error || !(error instanceof AppError)) return false
    return error.metadata.retryable === true
}

export const derivePrimarySignerType = (
    context: SigningMachineContext,
): Nullable<ResolvedSignerType> => {
    const { groupSignerTypes } = context
    if (!groupSignerTypes) return null
    const types = [...groupSignerTypes.values()]
    if (types.includes('hardware')) return 'hardware'
    if (types.includes('multisig')) return 'multisig'
    if (types.includes('localKey')) return 'localKey'
    return null
}

/**
 * Maps a machine snapshot + derived stage to a {@link SigningPipelineEvent}.
 *
 * Each branch accesses nullable context fields (analyses, transportResult, etc.)
 * that the machine guarantees are populated by the time the corresponding state
 * is reached. The null guards are intentionally defensive rather than asserting,
 * because this function runs inside a React effect subscription — a hard crash
 * here would unmount the signing UI instead of surfacing a recoverable error.
 */
export const deriveEvent = (
    snapshot: MachineSnapshot,
    stage: PipelineStage,
): Nullable<SigningPipelineEvent> => {
    switch (stage) {
        case 'awaiting_user': {
            const { analyses } = snapshot.context
            const analysis = analyses?.[0]
            if (!analysis) return null
            return {
                type: 'analysis_ready',
                analysis,
                signerType: derivePrimarySignerType(snapshot.context),
            }
        }
        case 'signing': {
            const signerType = derivePrimarySignerType(snapshot.context)
            if (!signerType) return null
            return { type: 'signing_started', signerType }
        }
        case 'transporting': {
            return { type: 'transport_started' }
        }
        case 'completed': {
            const { transportResult } = snapshot.context
            if (!transportResult) return null
            return { type: 'signing_completed', transportResult }
        }
        case 'rejected': {
            return { type: 'signing_rejected' }
        }
        case 'failed': {
            const { error, failedDuringState } = snapshot.context
            return {
                type: 'signing_failed',
                error: error ?? new Error('Unknown signing error'),
                failedDuringState,
                isRetryable: isRetryableError(error),
            }
        }
        default: {
            return null
        }
    }
}
