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

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { AnyActorRef } from 'xstate'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { mapToDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import {
    canSignWithAccount,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { AppError } from '@perawallet/wallet-core-shared'
import Decimal from 'decimal.js'
import type { SigningMachineContext } from '../machine/context'
import type { ResolvedSignerType } from '../machine/context'
import type { SignableAnalysis, TransportResult } from '../pipeline/types'
import type {
    SignRequest,
    TransactionSignRequest,
    TransactionWarning,
} from '../models'
import type {
    TransactionListItem,
    RequestStructure,
} from '../utils/classification'
import {
    createTransactionListItems,
    classifyRequestStructure,
} from '../utils/classification'
import { calculateTotalFee } from '../utils/fees'
import { aggregateTransactionWarnings } from '../utils/warnings'
import { useSigningRequest } from './useSigningRequest'

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration passed to useSigningPipeline.
 * The onEvent callback is called once per state transition.
 */
export type SigningConfiguration = {
    onEvent?: (event: SigningPipelineEvent) => void
}

/**
 * Flat representation of the signing machine's current state.
 * The 'signing' stage collapses all signing substates (localKey, ledger, multisig).
 */
export type PipelineStage =
    | 'idle' // no request or actor initializing
    | 'validating' // analyzerActor running
    | 'awaiting_user' // waiting for next() or fail()
    | 'signing' // localKey | ledger | multisig actor running
    | 'transporting' // transportActor delivering signed data
    | 'completed' // terminal: signing and delivery succeeded
    | 'rejected' // terminal: user cancelled
    | 'failed' // terminal or retryable: error occurred

/**
 * Events emitted by the pipeline when notable state transitions occur.
 * Fired once per transition via onEvent — not on every context update.
 */
export type SigningPipelineEvent =
    | {
          type: 'analysis_ready'
          /** The machine's analysis result (fees, warnings, risk level) */
          analysis: SignableAnalysis
          /** The signer type that will be used once approved */
          signerType: ResolvedSignerType | null
      }
    | {
          type: 'signing_started'
          signerType: ResolvedSignerType
      }
    | { type: 'transport_started' }
    | {
          type: 'signing_completed'
          transportResult: TransportResult
      }
    | { type: 'signing_rejected' }
    | {
          type: 'signing_failed'
          error: Error
          /** Which pipeline stage the failure occurred in */
          failedDuringState: 'validating' | 'signing' | 'transporting' | null
          isRetryable: boolean
      }
    /** Reserved for Ledger hardware wallet confirmation (Phase 8) */
    | { type: 'ledger_confirmation_requested' }

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

// =============================================================================
// Result type alias
// =============================================================================

export type UseSigningPipelineResult = SigningPipeline

// =============================================================================
// Snapshot helpers — typed against machine context shape
// =============================================================================

type MachineSnapshot = {
    value: unknown
    context: SigningMachineContext
    matches: (stateValue: string) => boolean
}

const deriveStage = (snapshot: MachineSnapshot): PipelineStage => {
    if (snapshot.matches('completed')) return 'completed'
    if (snapshot.matches('rejected')) return 'rejected'
    if (snapshot.matches('failed')) return 'failed'
    if (snapshot.matches('transporting')) return 'transporting'
    // 'signing' parent state covers routing, localKey, ledger, multisig substates
    if (snapshot.matches('signing')) return 'signing'
    if (snapshot.matches('awaiting_user')) return 'awaiting_user'
    if (snapshot.matches('validating')) return 'validating'
    if (snapshot.matches('idle')) return 'idle'
    return 'idle'
}

const isRetryableError = (error: Error | null): boolean => {
    if (!error || !(error instanceof AppError)) return false
    return error.metadata.retryable === true
}

const derivePrimarySignerType = (
    context: SigningMachineContext,
): ResolvedSignerType | null => {
    const { groupSignerTypes } = context
    if (!groupSignerTypes) return null
    const types = [...groupSignerTypes.values()]
    if (types.includes('ledger')) return 'ledger'
    if (types.includes('multisig')) return 'multisig'
    if (types.includes('localKey')) return 'localKey'
    return null
}

const deriveEvent = (
    snapshot: MachineSnapshot,
    stage: PipelineStage,
): SigningPipelineEvent | null => {
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
        case 'transporting':
            return { type: 'transport_started' }
        case 'completed': {
            const { transportResult } = snapshot.context
            if (!transportResult) return null
            return { type: 'signing_completed', transportResult }
        }
        case 'rejected':
            return { type: 'signing_rejected' }
        case 'failed': {
            const { error, failedDuringState } = snapshot.context
            return {
                type: 'signing_failed',
                error: error ?? new Error('Unknown signing error'),
                failedDuringState,
                isRetryable: isRetryableError(error),
            }
        }
        default:
            return null
    }
}

// =============================================================================
// Empty defaults
// =============================================================================

const EMPTY_TRANSACTIONS: PeraDisplayableTransaction[] = []
const EMPTY_LIST_ITEMS: TransactionListItem[] = []
const EMPTY_WARNINGS: TransactionWarning[] = []
const EMPTY_SIGNABLE_ADDRESSES = new Set<string>()
const ZERO_FEE = new Decimal(0)

// =============================================================================
// Hook
// =============================================================================

export const useSigningPipeline = (
    config: SigningConfiguration = {},
): UseSigningPipelineResult => {
    const { onEvent } = config

    const {
        currentRequest,
        currentActorRef,
        signAndSendRequest,
        rejectRequest,
        retryRequest,
    } = useSigningRequest()

    const accounts = useAllAccounts()

    // -------------------------------------------------------------------------
    // Display data — computed from the request's transaction payload.
    // Uses the same logic as useSigningRequestAnalysis for zero-regression.
    // -------------------------------------------------------------------------

    const txRequest =
        currentRequest?.type === 'transactions' && 'txs' in currentRequest
            ? (currentRequest as TransactionSignRequest)
            : undefined

    const allTransactions = useMemo(
        () =>
            (txRequest?.txs ?? [])
                .map(tx => mapToDisplayableTransaction(tx))
                .filter((tx): tx is PeraDisplayableTransaction => !!tx),
        [txRequest?.txs],
    )

    const listItems = useMemo(
        () => createTransactionListItems(allTransactions),
        [allTransactions],
    )

    const signableAddresses = useMemo(
        () =>
            new Set(
                accounts
                    .filter(a => canSignWithAccount(a, accounts))
                    .map(a => a.address),
            ),
        [accounts],
    )

    const totalFee = useMemo(
        () => calculateTotalFee(allTransactions, signableAddresses),
        [allTransactions, signableAddresses],
    )

    const warnings = useMemo(
        () => aggregateTransactionWarnings(allTransactions, signableAddresses),
        [allTransactions, signableAddresses],
    )

    const distinctWarnings = useMemo(
        () =>
            warnings.filter(
                (warning, index) =>
                    warnings.findIndex(w => w.type === warning.type) === index,
            ),
        [warnings],
    )

    const requestStructure = useMemo(
        () => classifyRequestStructure(listItems),
        [listItems],
    )

    // -------------------------------------------------------------------------
    // Machine state — derived from actor subscription
    // -------------------------------------------------------------------------

    const [stage, setStage] = useState<PipelineStage>('idle')
    const [error, setError] = useState<Error | null>(null)

    // Keep onEvent in a ref so the subscription closure never goes stale
    const onEventRef = useRef(onEvent)
    onEventRef.current = onEvent

    // Track the previous stage to fire events only on transitions
    const prevStageRef = useRef<PipelineStage | null>(null)

    useEffect(() => {
        if (!currentActorRef) {
            setStage('idle')
            setError(null)
            prevStageRef.current = null
            return
        }

        const subscription = (currentActorRef as AnyActorRef).subscribe(
            rawSnapshot => {
                const snapshot = rawSnapshot as MachineSnapshot
                const newStage = deriveStage(snapshot)

                setStage(newStage)
                setError(snapshot.context.error)

                if (newStage !== prevStageRef.current) {
                    const event = deriveEvent(snapshot, newStage)
                    if (event) {
                        onEventRef.current?.(event)
                    }
                    prevStageRef.current = newStage
                }
            },
        )

        return () => {
            subscription.unsubscribe()
            prevStageRef.current = null
        }
    }, [currentActorRef])

    // -------------------------------------------------------------------------
    // Controls
    // -------------------------------------------------------------------------

    const next = useCallback(() => {
        if (!currentRequest) return
        signAndSendRequest(currentRequest)
    }, [currentRequest, signAndSendRequest])

    const fail = useCallback(() => {
        if (!currentRequest) return
        rejectRequest(currentRequest)
    }, [currentRequest, rejectRequest])

    const retry = useCallback(() => {
        if (!currentRequest) return
        retryRequest(currentRequest)
    }, [currentRequest, retryRequest])

    // -------------------------------------------------------------------------
    // Derived flags
    // -------------------------------------------------------------------------

    const isLoading = stage === 'signing' || stage === 'transporting'
    const isRetryable = stage === 'failed' && isRetryableError(error)

    return {
        currentRequest,
        stage,
        isLoading,
        isRetryable,
        error,
        allTransactions: txRequest ? allTransactions : EMPTY_TRANSACTIONS,
        listItems: txRequest ? listItems : EMPTY_LIST_ITEMS,
        signableAddresses: txRequest
            ? signableAddresses
            : EMPTY_SIGNABLE_ADDRESSES,
        totalFee: txRequest ? totalFee : ZERO_FEE,
        warnings: txRequest ? warnings : EMPTY_WARNINGS,
        distinctWarnings: txRequest ? distinctWarnings : EMPTY_WARNINGS,
        requestStructure: txRequest ? requestStructure : 'single',
        next,
        fail,
        retry,
    }
}
